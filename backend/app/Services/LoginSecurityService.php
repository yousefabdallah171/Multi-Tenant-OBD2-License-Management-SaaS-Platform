<?php

namespace App\Services;

use Illuminate\Support\Facades\Cache;

class LoginSecurityService
{
    private const MAX_ATTEMPTS = 10;

    private const ATTEMPT_TTL_SECONDS = 86400;

    /**
     * @return array<string, mixed>
     */
    public function recordFailedAttempt(string $email, string $ip, string $userAgent = ''): array
    {
        $normalizedEmail = $this->normalizeEmail($email);
        $normalizedIp = trim($ip);

        $attemptCount = $this->incrementWithTtl($this->attemptKey($normalizedEmail), self::ATTEMPT_TTL_SECONDS);
        $this->incrementWithTtl($this->ipAttemptKey($normalizedIp), self::ATTEMPT_TTL_SECONDS);

        if ($attemptCount >= self::MAX_ATTEMPTS) {
            $this->blockIp($normalizedIp, $normalizedEmail, $userAgent);

            return [
                ...$this->isLocked($normalizedEmail, $normalizedIp),
                'attempt_count' => $attemptCount,
                'newly_blocked' => true,
            ];
        }

        $duration = $this->getLockoutDuration($attemptCount);
        if ($duration > 0) {
            $unlocksAt = now()->addSeconds($duration)->timestamp;

            Cache::put($this->lockKey($normalizedEmail), [
                'email' => $normalizedEmail,
                'ip' => $normalizedIp,
                'attempt_count' => $attemptCount,
                'user_agent' => $userAgent,
                'device' => $this->summarizeDevice($userAgent),
                'locked_at' => now()->timestamp,
                'unlocks_at' => $unlocksAt,
            ], now()->addSeconds($duration));

            $this->addToIndex($this->lockedEmailsIndexKey(), $normalizedEmail);

            return [
                'locked' => true,
                'reason' => 'account_locked',
                'attempt_count' => $attemptCount,
                'unlocks_at' => $unlocksAt,
                'seconds_remaining' => $duration,
                'newly_blocked' => false,
            ];
        }

        return [
            'locked' => false,
            'attempt_count' => $attemptCount,
            'newly_blocked' => false,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function isLocked(string $email, string $ip): array
    {
        $normalizedEmail = $this->normalizeEmail($email);
        $normalizedIp = trim($ip);

        /** @var array<string, mixed>|null $blocked */
        $blocked = Cache::get($this->blockedIpKey($normalizedIp));
        if (is_array($blocked)) {
            return [
                'locked' => true,
                'reason' => 'ip_blocked',
                'unlocks_at' => null,
                'seconds_remaining' => null,
                'ip' => $normalizedIp,
                'device' => (string) ($blocked['device'] ?? $this->summarizeDevice((string) ($blocked['user_agent'] ?? ''))),
            ];
        }

        /** @var array<string, mixed>|null $lock */
        $lock = Cache::get($this->lockKey($normalizedEmail));
        if (! is_array($lock)) {
            return ['locked' => false];
        }

        $unlocksAt = (int) ($lock['unlocks_at'] ?? 0);
        $remaining = $unlocksAt - now()->timestamp;

        if ($remaining <= 0) {
            Cache::forget($this->lockKey($normalizedEmail));
            $this->removeFromIndex($this->lockedEmailsIndexKey(), $normalizedEmail);

            return ['locked' => false];
        }

        return [
            'locked' => true,
            'reason' => 'account_locked',
            'attempt_count' => (int) ($lock['attempt_count'] ?? 0),
            'unlocks_at' => $unlocksAt,
            'seconds_remaining' => $remaining,
            'ip' => (string) ($lock['ip'] ?? ''),
            'device' => (string) ($lock['device'] ?? $this->summarizeDevice((string) ($lock['user_agent'] ?? ''))),
        ];
    }

    public function clearAttempts(string $email, string $ip): void
    {
        $normalizedEmail = $this->normalizeEmail($email);
        $normalizedIp = trim($ip);

        Cache::forget($this->attemptKey($normalizedEmail));
        Cache::forget($this->lockKey($normalizedEmail));
        Cache::forget($this->ipAttemptKey($normalizedIp));

        $this->removeFromIndex($this->lockedEmailsIndexKey(), $normalizedEmail);
    }

    public function getLockoutDuration(int $attemptCount): int
    {
        return match (true) {
            $attemptCount === 5 => 60,
            $attemptCount === 6 => 300,
            $attemptCount === 7 => 3600,
            $attemptCount === 8 => 36000,
            $attemptCount === 9 => 86400,
            default => 0,
        };
    }

    public function blockIp(string $ip, string $email = '', string $userAgent = ''): void
    {
        $normalizedIp = trim($ip);
        if ($normalizedIp === '') {
            return;
        }

        Cache::forever($this->blockedIpKey($normalizedIp), [
            'ip' => $normalizedIp,
            'blocked_at' => now()->toIso8601String(),
            'email' => $this->normalizeEmail($email),
            'user_agent' => $userAgent,
            'device' => $this->summarizeDevice($userAgent),
        ]);

        $this->addToIndex($this->blockedIpsIndexKey(), $normalizedIp);
    }

    public function unblockEmail(string $email): void
    {
        $normalizedEmail = $this->normalizeEmail($email);
        Cache::forget($this->attemptKey($normalizedEmail));
        Cache::forget($this->lockKey($normalizedEmail));
        $this->removeFromIndex($this->lockedEmailsIndexKey(), $normalizedEmail);
    }

    public function unblockIp(string $ip): void
    {
        $normalizedIp = trim($ip);
        Cache::forget($this->blockedIpKey($normalizedIp));
        Cache::forget($this->ipAttemptKey($normalizedIp));
        $this->removeFromIndex($this->blockedIpsIndexKey(), $normalizedIp);
    }

    public function getAttemptCount(string $email): int
    {
        return (int) Cache::get($this->attemptKey($this->normalizeEmail($email)), 0);
    }

    public function getRemainingAttempts(string $email): int
    {
        return max(0, self::MAX_ATTEMPTS - $this->getAttemptCount($email));
    }

    public function getResetTimestamp(): int
    {
        return now()->addSeconds(self::ATTEMPT_TTL_SECONDS)->timestamp;
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    public function getLockedAccounts(): array
    {
        $emails = Cache::get($this->lockedEmailsIndexKey(), []);
        if (! is_array($emails)) {
            return [];
        }

        $rows = [];
        foreach ($emails as $email) {
            if (! is_string($email) || $email === '') {
                continue;
            }

            /** @var array<string, mixed>|null $lock */
            $lock = Cache::get($this->lockKey($email));
            if (! is_array($lock)) {
                $this->removeFromIndex($this->lockedEmailsIndexKey(), $email);
                continue;
            }

            $remaining = (int) ($lock['unlocks_at'] ?? 0) - now()->timestamp;
            if ($remaining <= 0) {
                Cache::forget($this->lockKey($email));
                $this->removeFromIndex($this->lockedEmailsIndexKey(), $email);
                continue;
            }

            $rows[] = [
                'email' => $email,
                'attempt_count' => (int) ($lock['attempt_count'] ?? 0),
                'ip' => (string) ($lock['ip'] ?? ''),
                'user_agent' => (string) ($lock['user_agent'] ?? ''),
                'device' => (string) ($lock['device'] ?? $this->summarizeDevice((string) ($lock['user_agent'] ?? ''))),
                'seconds_remaining' => $remaining,
                'unlocks_at' => (int) ($lock['unlocks_at'] ?? 0),
            ];
        }

        return $rows;
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    public function getBlockedIps(): array
    {
        $ips = Cache::get($this->blockedIpsIndexKey(), []);
        if (! is_array($ips)) {
            return [];
        }

        $rows = [];
        foreach ($ips as $ip) {
            if (! is_string($ip) || $ip === '') {
                continue;
            }

            /** @var array<string, mixed>|null $blocked */
            $blocked = Cache::get($this->blockedIpKey($ip));
            if (! is_array($blocked)) {
                $this->removeFromIndex($this->blockedIpsIndexKey(), $ip);
                continue;
            }

            $rows[] = [
                'ip' => $ip,
                'blocked_at' => (string) ($blocked['blocked_at'] ?? ''),
                'email' => (string) ($blocked['email'] ?? ''),
                'user_agent' => (string) ($blocked['user_agent'] ?? ''),
                'device' => (string) ($blocked['device'] ?? $this->summarizeDevice((string) ($blocked['user_agent'] ?? ''))),
            ];
        }

        return $rows;
    }

    public function summarizeDevice(string $userAgent): string
    {
        $ua = strtolower($userAgent);
        if ($ua === '') {
            return 'Unknown Device';
        }

        $device = match (true) {
            str_contains($ua, 'iphone') => 'iPhone',
            str_contains($ua, 'ipad') => 'iPad',
            str_contains($ua, 'android') => 'Android',
            str_contains($ua, 'windows') => 'Windows',
            str_contains($ua, 'macintosh'), str_contains($ua, 'mac os') => 'Mac',
            str_contains($ua, 'linux') => 'Linux',
            default => 'Device',
        };

        $browser = match (true) {
            str_contains($ua, 'edg/') => 'Edge',
            str_contains($ua, 'chrome/') && ! str_contains($ua, 'edg/') => 'Chrome',
            str_contains($ua, 'safari/') && ! str_contains($ua, 'chrome/') => 'Safari',
            str_contains($ua, 'firefox/') => 'Firefox',
            default => 'Browser',
        };

        return trim($device.' '.$browser);
    }

    private function normalizeEmail(string $email): string
    {
        return strtolower(trim($email));
    }

    private function incrementWithTtl(string $key, int $ttlSeconds): int
    {
        if (! Cache::has($key)) {
            Cache::put($key, 0, now()->addSeconds($ttlSeconds));
        }

        return (int) Cache::increment($key);
    }

    private function addToIndex(string $key, string $value): void
    {
        $current = Cache::get($key, []);
        $list = is_array($current) ? $current : [];

        if (! in_array($value, $list, true)) {
            $list[] = $value;
            Cache::forever($key, $list);
        }
    }

    private function removeFromIndex(string $key, string $value): void
    {
        $current = Cache::get($key, []);
        $list = is_array($current) ? $current : [];

        $next = array_values(array_filter($list, static fn (mixed $item): bool => $item !== $value));
        Cache::forever($key, $next);
    }

    private function attemptKey(string $email): string
    {
        return 'login_attempts:'.$email;
    }

    private function ipAttemptKey(string $ip): string
    {
        return 'login_attempts_ip:'.$ip;
    }

    private function lockKey(string $email): string
    {
        return 'login_locked:'.$email;
    }

    private function blockedIpKey(string $ip): string
    {
        return 'ip_blocked:'.$ip;
    }

    private function lockedEmailsIndexKey(): string
    {
        return 'security:locked_emails';
    }

    private function blockedIpsIndexKey(): string
    {
        return 'security:blocked_ips';
    }
}

