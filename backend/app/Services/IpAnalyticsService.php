<?php

namespace App\Services;

use App\Models\License;
use App\Models\Program;
use Carbon\CarbonImmutable;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

class IpAnalyticsService
{
    /**
     * @return array<int, array{username: string, timestamp: string, raw_timestamp: string, ip_address: string}>
     */
    public function parseExternalLogs(string $rawText): array
    {
        $lines = preg_split('/\r\n|\r|\n/', trim($rawText)) ?: [];
        $logs = [];

        foreach ($lines as $line) {
            $trimmed = trim($line);
            if ($trimmed === '') {
                continue;
            }

            if (! preg_match('/^(\S+)\s+(.+?)\s+((?:\d{1,3}\.){3}\d{1,3})$/', $trimmed, $matches)) {
                continue;
            }

            $rawTimestamp = trim((string) $matches[2]);
            $normalizedTimestamp = $this->normalizeExternalLogTimestampToIsoUtc($rawTimestamp) ?? $rawTimestamp;

            $logs[] = [
                'username' => trim((string) $matches[1]),
                'timestamp' => $normalizedTimestamp,
                'raw_timestamp' => $rawTimestamp,
                'ip_address' => trim((string) $matches[3]),
            ];
        }

        return $logs;
    }

    /**
     * @param  array<int, array{username: string, timestamp: string, raw_timestamp: string, ip_address: string}>  $parsedLogs
     * @return array<int, array<string, mixed>>
     */
    public function matchLogsToDatabaseRecords(array $parsedLogs, int $tenantId): array
    {
        /** @var Collection<int, Program> $programs */
        $programs = Program::query()
            ->where('tenant_id', $tenantId)
            ->whereNotNull('external_software_id')
            ->get(['id', 'tenant_id', 'name', 'external_software_id']);

        $programByExternalId = $programs->keyBy(fn (Program $program): string => (string) $program->external_software_id);

        $matched = [];

        foreach ($parsedLogs as $log) {
            $externalId = null;
            $customerName = $log['username'];

            if (preg_match('/^custo(\d+)_(.+)$/i', $log['username'], $matches)) {
                $externalId = (int) $matches[1];
                $customerName = trim((string) $matches[2]);
            }

            $program = $externalId !== null ? $programByExternalId->get((string) $externalId) : null;
            $license = $program ? $this->findMatchingLicense($tenantId, $program->id, $customerName) : null;

            $matched[] = [
                'username' => $customerName,
                'raw_username' => $log['username'],
                'timestamp' => $log['timestamp'],
                'raw_timestamp' => $log['raw_timestamp'] ?? null,
                'ip_address' => $log['ip_address'],
                'bios_id' => $license?->bios_id,
                'customer_id' => $license?->customer_id,
                'customer_name' => $license?->customer?->name,
                'customer_username' => $license?->customer?->username,
                'reseller_id' => $license?->reseller_id,
                'reseller_name' => $license?->reseller?->name,
                'program_id' => $program?->id,
                'program_name' => $program?->name,
                'external_software_id' => $externalId,
            ];
        }

        return $matched;
    }

    /**
     * @param array<int, array<string, mixed>> $enrichedLogs
     * @return array<int, array<string, mixed>>
     */
    public function formatResponse(array $enrichedLogs): array
    {
        return array_values($enrichedLogs);
    }

    private function findMatchingLicense(int $tenantId, int $programId, string $customerName): ?License
    {
        $normalized = mb_strtolower(trim($customerName));
        if ($normalized === '') {
            return null;
        }

        return License::query()
            ->with(['customer:id,name,username', 'reseller:id,name,email'])
            ->where('tenant_id', $tenantId)
            ->where('program_id', $programId)
            ->where(function ($query) use ($normalized, $tenantId): void {
                $query
                    ->whereRaw('LOWER(external_username) = ?', [$normalized])
                    ->orWhereHas('customer', function ($customerQuery) use ($normalized, $tenantId): void {
                        $customerQuery
                            ->whereRaw('LOWER(name) = ?', [$normalized])
                            ->orWhereRaw('LOWER(username) = ?', [$normalized])
                            ->orWhereExists(function ($sub) use ($normalized, $tenantId): void {
                                $sub->select(DB::raw(1))
                                    ->from('user_username_history')
                                    ->where('user_username_history.tenant_id', $tenantId)
                                    ->whereColumn('user_username_history.user_id', 'users.id')
                                    ->whereRaw('LOWER(user_username_history.old_username) = ?', [$normalized]);
                            });
                    });
            })
            ->latest('id')
            ->first();
    }

    private function normalizeExternalLogTimestampToIsoUtc(string $value): ?string
    {
        $trimmed = trim(preg_replace('/\s+/', ' ', $value) ?? '');
        if ($trimmed === '') {
            return null;
        }

        // Example line segment: "Sun:Apr:19:2026 16:25:37"
        // We treat the external log timestamp as UTC because the platform uses UTC internally.
        if (! preg_match('/^(?<dow>[A-Za-z]{3}):(?<mon>[A-Za-z]{3}):(?<day>\d{1,2}):(?<year>\d{4})\s+(?<time>\d{2}:\d{2}:\d{2})$/', $trimmed, $matches)) {
            return null;
        }

        $monthMap = [
            'jan' => 1,
            'feb' => 2,
            'mar' => 3,
            'apr' => 4,
            'may' => 5,
            'jun' => 6,
            'jul' => 7,
            'aug' => 8,
            'sep' => 9,
            'oct' => 10,
            'nov' => 11,
            'dec' => 12,
        ];

        $monthKey = mb_strtolower((string) ($matches['mon'] ?? ''));
        $month = $monthMap[$monthKey] ?? null;
        if (! $month) {
            return null;
        }

        $year = (int) ($matches['year'] ?? 0);
        $day = (int) ($matches['day'] ?? 0);
        $time = (string) ($matches['time'] ?? '');

        if ($year < 1970 || $day < 1 || $day > 31 || $time === '') {
            return null;
        }

        try {
            $dt = CarbonImmutable::createFromFormat(
                'Y-n-j H:i:s',
                sprintf('%d-%d-%d %s', $year, $month, $day, $time),
                'UTC'
            );

            return $dt->setTimezone('UTC')->toIso8601String();
        } catch (\Throwable) {
            return null;
        }
    }
}
