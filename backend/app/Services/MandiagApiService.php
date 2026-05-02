<?php

namespace App\Services;

use App\Models\ApiLog;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use Throwable;

class MandiagApiService
{
    public function createReseller(string $subId, string $realname, ?string $email): array
    {
        return $this->sendJson('POST', '/resellers', [
            'sub_id' => $subId,
            'realname' => $realname,
            'contact_email' => $email,
        ]);
    }

    public function setPricing(string $subId, string $softwareKey, array $pricingRows): array
    {
        $rows = array_map(
            static fn (array $row): array => [
                'software' => $softwareKey,
                'duration' => (string) ($row['duration'] ?? ''),
                'price' => (float) ($row['price'] ?? 0),
            ],
            $pricingRows
        );

        return $this->sendJson('PUT', '/resellers/'.rawurlencode($subId).'/pricing', [
            'software_pricing' => $rows,
            'ac360_usd_prices' => [],
        ]);
    }

    public function createLicense(
        string $subId,
        string $softwareKey,
        string $duration,
        string $hwid,
        string $customer,
        string $customerName
    ): array {
        return $this->sendJson('POST', '/licenses', [
            'sub_id' => $subId,
            'software' => $softwareKey,
            'duration' => $duration,
            'hwid' => $hwid,
            'customer' => $customer,
            'customer_name' => $customerName,
        ]);
    }

    public function renewLicense(int $mandiagLicenseId, string $duration): array
    {
        return $this->sendJson('POST', '/licenses/'.rawurlencode((string) $mandiagLicenseId).'/renew', [
            'duration' => $duration,
        ]);
    }

    public function disableLicense(int $mandiagLicenseId, ?string $reason = null): array
    {
        return $this->sendJson('POST', '/licenses/'.rawurlencode((string) $mandiagLicenseId).'/disable', [
            'reason' => $reason,
        ]);
    }

    public function enableLicense(int $mandiagLicenseId): array
    {
        return $this->sendJson('POST', '/licenses/'.rawurlencode((string) $mandiagLicenseId).'/enable', []);
    }

    public function setExpiration(int $mandiagLicenseId, string $expireDate): array
    {
        return $this->sendJson('PATCH', '/licenses/'.rawurlencode((string) $mandiagLicenseId).'/expiration', [
            'expire_date' => $expireDate,
        ]);
    }

    public function ping(): array
    {
        return $this->sendJson('GET', '/ping');
    }

    public static function durationDaysToKey(int $days): string
    {
        $map = [
            1 => '1day',
            7 => '1week',
            30 => '1month',
            90 => '3months',
            180 => '6months',
            365 => '1year',
            730 => '2years',
        ];

        foreach ($map as $target => $durationKey) {
            if (abs($days - $target) <= 3) {
                return $durationKey;
            }
        }

        throw new \InvalidArgumentException('Invalid duration for Mandiag integration. Use 1, 7, 30, 90, 180, 365, or 730 days.');
    }

    public static function buildSubId(int $userId): string
    {
        return 'u'.$userId;
    }

    /**
     * @param array<string, mixed> $payload
     * @return array{success: bool, data: array<string, mixed>, status_code: int, error_code?: string, error_message?: string}
     */
    private function sendJson(string $method, string $path, array $payload = []): array
    {
        $startedAt = microtime(true);
        $method = strtoupper($method);
        $url = rtrim((string) config('mandiag.base_url'), '/').'/'.ltrim($path, '/');
        $timestamp = (string) time();
        $body = $method === 'GET' ? '' : json_encode($payload, JSON_UNESCAPED_SLASHES);
        $signature = hash_hmac('sha256', $timestamp.'.'.$body, (string) config('mandiag.signing_secret'));

        $headers = [
            'X-Mandiag-Key' => (string) config('mandiag.api_key'),
            'X-Mandiag-Timestamp' => $timestamp,
            'X-Mandiag-Signature' => $signature,
            'Content-Type' => 'application/json',
            'Accept' => 'application/json',
        ];

        if (in_array($method, ['POST', 'PUT', 'PATCH', 'DELETE'], true)) {
            $headers['Idempotency-Key'] = bin2hex(random_bytes(16));
        }

        $safePayload = $payload;
        foreach (['api_key', 'key', 'token', 'authorization', 'X-Mandiag-Key', 'X-Mandiag-Signature'] as $secretKey) {
            if (array_key_exists($secretKey, $safePayload)) {
                $safePayload[$secretKey] = '[REDACTED]';
            }
        }

        try {
            $request = Http::withHeaders($headers)
                ->connectTimeout(3)
                ->timeout(8)
                ->withOptions(['verify' => true]);

            $response = $request->send($method, $url, [
                'body' => $body,
            ]);

            $decoded = json_decode((string) $response->body(), true);
            if (! is_array($decoded)) {
                $decoded = [];
            }

            $success = (bool) ($decoded['success'] ?? false);
            $data = is_array($decoded['data'] ?? null) ? $decoded['data'] : [];
            $error = is_array($decoded['error'] ?? null) ? $decoded['error'] : [];

            $result = [
                'success' => $success,
                'data' => $data,
                'status_code' => $response->status(),
            ];

            if (! $success) {
                $result['error_code'] = (string) ($error['code'] ?? '');
                $result['error_message'] = (string) ($error['message'] ?? '');
            }

            $this->logApiCall('mandiag:'.$path, $method, $safePayload, $result, $response->status(), $startedAt);

            return $result;
        } catch (Throwable $exception) {
            $result = $this->normalizeException($exception);
            $this->logApiCall('mandiag:'.$path, $method, $safePayload, $result, (int) $result['status_code'], $startedAt);

            return $result;
        }
    }

    /**
     * @return array{success: bool, data: array<string, mixed>, status_code: int, error_code: string, error_message: string}
     */
    private function normalizeException(Throwable $exception): array
    {
        $rawMessage = trim($exception->getMessage());
        $normalizedMessage = Str::lower($rawMessage);
        $isTimeout = $exception instanceof ConnectionException
            || Str::contains($normalizedMessage, ['curl error 28', 'timed out', 'timeout']);

        if ($isTimeout) {
            return [
                'success' => false,
                'data' => ['message' => $rawMessage],
                'status_code' => 503,
                'error_code' => 'connection_timeout',
                'error_message' => 'The external service is not responding. Try again or schedule for later.',
            ];
        }

        return [
            'success' => false,
            'data' => ['message' => $rawMessage],
            'status_code' => 503,
            'error_code' => 'unavailable',
            'error_message' => 'The external service is unavailable. Try again or schedule the activation for later.',
        ];
    }

    /**
     * @param array<string, mixed> $payload
     * @param array<string, mixed> $responseBody
     */
    private function logApiCall(string $endpoint, string $method, array $payload, array $responseBody, int $statusCode, float $startedAt): void
    {
        try {
            $user = auth()->user();

            ApiLog::query()->create([
                'tenant_id' => $user?->tenant_id,
                'user_id' => $user?->id,
                'endpoint' => $endpoint,
                'method' => $method,
                'request_body' => $payload === [] ? null : $payload,
                'response_body' => $responseBody === [] ? null : $responseBody,
                'status_code' => $statusCode,
                'response_time_ms' => (int) round((microtime(true) - $startedAt) * 1000),
            ]);
        } catch (Throwable) {
            // Telemetry must never break business flow.
        }
    }
}
