<?php

namespace Tests\Unit;

use App\Services\LoginSecurityService;
use Illuminate\Support\Facades\Cache;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

class LoginSecurityServiceTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        Cache::flush();
    }

    #[DataProvider('lockoutDurationProvider')]
    public function test_lockout_duration_progression_matches_spec(int $attemptCount, int $expected): void
    {
        $service = app(LoginSecurityService::class);

        $this->assertSame($expected, $service->getLockoutDuration($attemptCount));
    }

    public function test_it_locks_account_on_fifth_failed_attempt(): void
    {
        $service = app(LoginSecurityService::class);
        $email = 'test@example.com';
        $ip = '197.55.1.2';

        for ($i = 0; $i < 5; $i++) {
            $service->recordFailedAttempt($email, $ip, 'Mozilla/5.0');
        }

        $status = $service->isLocked($email, $ip);
        $this->assertTrue($status['locked']);
        $this->assertSame('account_locked', $status['reason']);
    }

    public function test_it_blocks_ip_after_tenth_failed_attempt(): void
    {
        $service = app(LoginSecurityService::class);
        $email = 'blocked@example.com';
        $ip = '197.55.1.3';

        for ($i = 0; $i < 10; $i++) {
            $service->recordFailedAttempt($email, $ip, 'Mozilla/5.0 (iPhone; CPU iPhone OS)');
        }

        $status = $service->isLocked($email, $ip);
        $this->assertTrue($status['locked']);
        $this->assertSame('ip_blocked', $status['reason']);
    }

    public function test_unblock_methods_clear_account_and_ip_locks(): void
    {
        $service = app(LoginSecurityService::class);
        $email = 'unlock@example.com';
        $ip = '197.55.1.4';

        for ($i = 0; $i < 10; $i++) {
            $service->recordFailedAttempt($email, $ip, 'Mozilla/5.0');
        }

        $service->unblockEmail($email);
        $service->unblockIp($ip);

        $this->assertFalse($service->isLocked($email, $ip)['locked']);
    }

    #[DataProvider('deviceSummaryProvider')]
    public function test_summarize_device_detects_common_platform_and_browser(string $userAgent, string $expected): void
    {
        $service = app(LoginSecurityService::class);

        $this->assertSame($expected, $service->summarizeDevice($userAgent));
    }

    public function test_get_attempt_count_normalizes_email_case_and_spaces(): void
    {
        $service = app(LoginSecurityService::class);
        $service->recordFailedAttempt('  USER@Example.com ', '197.55.1.5', 'Mozilla/5.0');

        $this->assertSame(1, $service->getAttemptCount('user@example.com'));
    }

    #[DataProvider('remainingAttemptsProvider')]
    public function test_get_remaining_attempts_tracks_progression(int $failedAttempts, int $expectedRemaining): void
    {
        $service = app(LoginSecurityService::class);
        $email = 'remaining-check@example.com';
        $ip = '197.55.1.8';

        for ($i = 0; $i < $failedAttempts; $i++) {
            $service->recordFailedAttempt($email, $ip, 'Mozilla/5.0');
        }

        $this->assertSame($expectedRemaining, $service->getRemainingAttempts($email));
    }

    public function test_get_reset_timestamp_is_about_one_day_ahead(): void
    {
        $service = app(LoginSecurityService::class);

        $timestamp = $service->getResetTimestamp();

        $this->assertGreaterThanOrEqual(now()->addSeconds(86390)->timestamp, $timestamp);
        $this->assertLessThanOrEqual(now()->addSeconds(86410)->timestamp, $timestamp);
    }

    public function test_block_ip_ignores_empty_ip_values(): void
    {
        $service = app(LoginSecurityService::class);
        $service->blockIp('   ', 'empty-ip@example.com', 'Mozilla/5.0');

        $this->assertSame([], $service->getBlockedIps());
    }

    public function test_get_locked_accounts_returns_email_and_device_shape(): void
    {
        $service = app(LoginSecurityService::class);
        $email = 'shape@example.com';
        $ip = '197.55.1.10';
        for ($i = 0; $i < 5; $i++) {
            $service->recordFailedAttempt($email, $ip, 'Mozilla/5.0 (Windows NT 10.0) Chrome/120');
        }

        $rows = $service->getLockedAccounts();

        $this->assertCount(1, $rows);
        $this->assertSame($email, $rows[0]['email']);
        $this->assertArrayHasKey('seconds_remaining', $rows[0]);
        $this->assertSame('Windows Chrome', $rows[0]['device']);
    }

    public function test_get_locked_accounts_removes_expired_lock_rows(): void
    {
        $service = app(LoginSecurityService::class);
        $email = 'expired@example.com';
        $ip = '197.55.1.11';

        for ($i = 0; $i < 5; $i++) {
            $service->recordFailedAttempt($email, $ip, 'Mozilla/5.0');
        }

        $this->assertNotEmpty($service->getLockedAccounts());

        $this->travel(61)->seconds();

        $this->assertSame([], $service->getLockedAccounts());
        $this->assertFalse($service->isLocked($email, $ip)['locked']);
    }

    public function test_get_blocked_ips_returns_block_metadata_shape(): void
    {
        $service = app(LoginSecurityService::class);
        $service->blockIp('197.55.1.12', 'blocked-shape@example.com', 'Mozilla/5.0 (iPhone) Safari/16');

        $rows = $service->getBlockedIps();

        $this->assertCount(1, $rows);
        $this->assertSame('197.55.1.12', $rows[0]['ip']);
        $this->assertSame('blocked-shape@example.com', $rows[0]['email']);
        $this->assertSame('iPhone Safari', $rows[0]['device']);
    }

    public function test_unblock_email_is_idempotent_when_not_locked(): void
    {
        $service = app(LoginSecurityService::class);

        $service->unblockEmail('not-locked@example.com');

        $this->assertSame([], $service->getLockedAccounts());
    }

    public function test_unblock_ip_is_idempotent_when_not_blocked(): void
    {
        $service = app(LoginSecurityService::class);

        $service->unblockIp('197.55.1.13');

        $this->assertSame([], $service->getBlockedIps());
    }

    /**
     * @return array<string, array{int, int}>
     */
    public static function lockoutDurationProvider(): array
    {
        return [
            'attempt 1' => [1, 0],
            'attempt 2' => [2, 0],
            'attempt 3' => [3, 0],
            'attempt 4' => [4, 0],
            'attempt 5' => [5, 60],
            'attempt 6' => [6, 300],
            'attempt 7' => [7, 3600],
            'attempt 8' => [8, 36000],
            'attempt 9' => [9, 86400],
            'attempt 10' => [10, 0],
            'attempt 11' => [11, 0],
        ];
    }

    /**
     * @return array<string, array{string, string}>
     */
    public static function deviceSummaryProvider(): array
    {
        return [
            'iphone safari' => ['Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit Safari/605.1', 'iPhone Safari'],
            'ipad safari' => ['Mozilla/5.0 (iPad; CPU OS 16_0 like Mac OS X) AppleWebKit Safari/604.1', 'iPad Safari'],
            'android chrome' => ['Mozilla/5.0 (Linux; Android 14) AppleWebKit Chrome/120.0 Mobile Safari/537.36', 'Android Chrome'],
            'windows chrome' => ['Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit Chrome/120.0 Safari/537.36', 'Windows Chrome'],
            'windows edge' => ['Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit Chrome/120.0 Safari/537.36 Edg/120.0', 'Windows Edge'],
            'mac firefox' => ['Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Firefox/122.0', 'Mac Firefox'],
            'linux browser unknown' => ['Mozilla/5.0 (X11; Linux x86_64)', 'Linux Browser'],
            'empty' => ['', 'Unknown Device'],
            'unknown only browser' => ['CustomClient/1.0', 'Device Browser'],
        ];
    }

    /**
     * @return array<string, array{int, int}>
     */
    public static function remainingAttemptsProvider(): array
    {
        return [
            'none used' => [0, 10],
            'one used' => [1, 9],
            'four used' => [4, 6],
            'five used' => [5, 5],
            'ten used' => [10, 0],
            'eleven used' => [11, 0],
        ];
    }
}
