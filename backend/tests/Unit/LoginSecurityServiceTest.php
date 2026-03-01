<?php

namespace Tests\Unit;

use App\Services\LoginSecurityService;
use Illuminate\Support\Facades\Cache;
use Tests\TestCase;

class LoginSecurityServiceTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        Cache::flush();
    }

    public function test_lockout_duration_progression_matches_spec(): void
    {
        $service = app(LoginSecurityService::class);

        $this->assertSame(60, $service->getLockoutDuration(5));
        $this->assertSame(300, $service->getLockoutDuration(6));
        $this->assertSame(3600, $service->getLockoutDuration(7));
        $this->assertSame(36000, $service->getLockoutDuration(8));
        $this->assertSame(86400, $service->getLockoutDuration(9));
        $this->assertSame(0, $service->getLockoutDuration(4));
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
}

