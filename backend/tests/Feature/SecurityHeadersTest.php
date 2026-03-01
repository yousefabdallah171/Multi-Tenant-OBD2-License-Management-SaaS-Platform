<?php

namespace Tests\Feature;

use Tests\TestCase;

class SecurityHeadersTest extends TestCase
{
    public function test_health_endpoint_includes_required_security_headers(): void
    {
        $response = $this->getJson('/api/health');

        $response->assertOk();
        $this->assertRequiredSecurityHeaders($response->headers->all());
    }

    public function test_protected_endpoint_includes_required_security_headers(): void
    {
        $response = $this->getJson('/api/auth/me');

        $response->assertStatus(401);
        $this->assertRequiredSecurityHeaders($response->headers->all());
    }

    /**
     * @param array<string, array<int, string>> $headers
     */
    private function assertRequiredSecurityHeaders(array $headers): void
    {
        $this->assertSame(
            "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
            $headers['content-security-policy'][0] ?? null
        );
        $this->assertSame('DENY', $headers['x-frame-options'][0] ?? null);
        $this->assertSame('nosniff', $headers['x-content-type-options'][0] ?? null);
        $this->assertSame('no-referrer', $headers['referrer-policy'][0] ?? null);
    }
}
