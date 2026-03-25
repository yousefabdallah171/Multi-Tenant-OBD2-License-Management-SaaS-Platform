<?php

namespace App\Services;

use App\Models\License;
use App\Models\Program;
use Illuminate\Support\Collection;

class IpAnalyticsService
{
    /**
     * @return array<int, array{username: string, timestamp: string, ip_address: string}>
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

            $logs[] = [
                'username' => trim((string) $matches[1]),
                'timestamp' => trim((string) $matches[2]),
                'ip_address' => trim((string) $matches[3]),
            ];
        }

        return $logs;
    }

    /**
     * @param  array<int, array{username: string, timestamp: string, ip_address: string}>  $parsedLogs
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
            ->where(function ($query) use ($normalized): void {
                $query->whereRaw('LOWER(external_username) = ?', [$normalized])
                    ->orWhereHas('customer', function ($customerQuery) use ($normalized): void {
                        $customerQuery
                            ->whereRaw('LOWER(name) = ?', [$normalized])
                            ->orWhereRaw('LOWER(username) = ?', [$normalized]);
                    });
            })
            ->latest('id')
            ->first();
    }
}
