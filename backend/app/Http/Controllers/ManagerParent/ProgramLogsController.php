<?php

namespace App\Http\Controllers\ManagerParent;

use App\Models\Program;
use App\Models\License;
use App\Services\ExternalApiService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ProgramLogsController extends BaseManagerParentController
{
    public function __construct(private readonly ExternalApiService $externalApiService)
    {
    }

    public function show(Request $request, Program $program): JsonResponse
    {
        $validated = $request->validate([
            'page' => ['nullable', 'integer', 'min:1'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:200'],
        ]);
        $page = (int) ($validated['page'] ?? 1);
        $perPage = (int) ($validated['per_page'] ?? 100);

        $resolved = $this->resolveProgram($request, $program);
        $guard = $this->guardExternalApi($resolved);
        if ($guard !== null) {
            return $guard;
        }

        $response = $this->externalApiService->getProgramLogs((int) $resolved->external_software_id);
        $externalOk = (bool) ($response['success'] ?? false);
        $licensesMap = License::query()
            ->where('tenant_id', $this->currentTenantId($request))
            ->where('program_id', $resolved->id)
            ->with(['reseller:id,name,email', 'customer:id,name,email,username'])
            ->get()
            ->filter(fn (License $license): bool => filled($license->external_username))
            ->mapWithKeys(fn (License $license): array => [
                (string) $license->external_username => [[
                    'license_id' => $license->id,
                    'bios_id' => $license->bios_id,
                    'external_username' => $license->external_username,
                    'customer_id' => $license->customer_id,
                    'customer_name' => $license->customer?->name,
                    'customer_username' => $license->customer?->username,
                    'reseller_id' => $license->reseller_id,
                    'reseller_name' => $license->reseller?->name,
                    'reseller_email' => $license->reseller?->email,
                ]],
            ]);

        $raw = (string) ($response['data']['raw'] ?? '');
        $lines = preg_split('/\r\n|\r|\n/', $raw) ?: [];
        $rows = [];

        foreach ($lines as $line) {
            $trimmed = trim((string) $line);
            if ($trimmed === '') {
                continue;
            }

            if (preg_match('/new user added - (.+?) with bios - (.+?) at time (.+)$/i', $trimmed, $matches)) {
                $username = trim($matches[1]);
                $licenseInfo = ($licensesMap->get($username) ?? [])[0] ?? null;
                $rows[] = [
                    'type' => 'add',
                    'username' => $username,
                    'bios_id' => trim($matches[2]),
                    'timestamp' => trim($matches[3]),
                    'customer_id' => $licenseInfo['customer_id'] ?? null,
                ];
                continue;
            }

            if (preg_match('/user deleted - (.+?) at time (.+)$/i', $trimmed, $matches)) {
                $username = trim($matches[1]);
                $licenseInfo = ($licensesMap->get($username) ?? [])[0] ?? null;
                $rows[] = [
                    'type' => 'delete',
                    'username' => $username,
                    'timestamp' => trim($matches[2]),
                    'customer_id' => $licenseInfo['customer_id'] ?? null,
                ];
                continue;
            }

            if (preg_match('/^(\S+)\s+(.+?)\s+((?:\d{1,3}\.){3}\d{1,3})$/', $trimmed, $matches)) {
                $username = trim($matches[1]);
                $licenseInfo = ($licensesMap->get($username) ?? [])[0] ?? null;
                $rows[] = [
                    'type' => 'login',
                    'username' => $username,
                    'timestamp' => trim($matches[2]),
                    'ip' => trim($matches[3]),
                    'customer_id' => $licenseInfo['customer_id'] ?? null,
                ];
            }
        }

        $total = count($rows);
        $offset = max(0, ($page - 1) * $perPage);
        $pagedRows = array_slice($rows, $offset, $perPage);
        $lastPage = max(1, (int) ceil($total / $perPage));

        return response()->json([
            'data' => [
                ...$response['data'],
                'licenses' => $licensesMap,
                'rows' => $pagedRows,
                'external_available' => $externalOk,
                'meta' => [
                    'page' => $page,
                    'per_page' => $perPage,
                    'total' => $total,
                    'last_page' => $lastPage,
                    'has_next_page' => $page < $lastPage,
                    'next_page' => $page < $lastPage ? $page + 1 : null,
                ],
            ],
            'message' => $externalOk ? null : 'External API is currently unavailable. Showing cached/empty logs.',
        ], 200);
    }

    public function activeUsers(Request $request, Program $program): JsonResponse
    {
        $resolved = $this->resolveProgram($request, $program);
        $guard = $this->guardExternalApi($resolved);
        if ($guard !== null) {
            return $guard;
        }

        $response = $this->externalApiService->getActiveUsers((int) $resolved->external_software_id);
        $externalOk = (bool) ($response['success'] ?? false);

        return response()->json([
            'data' => $response['data'],
            'external_available' => $externalOk,
            'message' => $externalOk ? null : 'External API is currently unavailable.',
        ], 200);
    }

    public function stats(Request $request, Program $program): JsonResponse
    {
        $resolved = $this->resolveProgram($request, $program);
        $guard = $this->guardExternalApi($resolved);
        if ($guard !== null) {
            return $guard;
        }

        $response = $this->externalApiService->getSoftwareStats((int) $resolved->external_software_id);
        $externalOk = (bool) ($response['success'] ?? false);

        return response()->json([
            'data' => $response['data'],
            'external_available' => $externalOk,
            'message' => $externalOk ? null : 'External API is currently unavailable.',
        ], 200);
    }

    private function resolveProgram(Request $request, Program $program): Program
    {
        abort_unless((int) $program->tenant_id === $this->currentTenantId($request), 403);

        return $program;
    }

    private function guardExternalApi(Program $program): ?JsonResponse
    {
        if (! $program->has_external_api || ! $program->external_software_id) {
            return response()->json([
                'message' => 'No external API configured for this program.',
            ], 422);
        }

        return null;
    }
}
