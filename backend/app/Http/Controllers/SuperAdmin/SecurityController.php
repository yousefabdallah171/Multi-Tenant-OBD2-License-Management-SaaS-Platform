<?php

namespace App\Http\Controllers\SuperAdmin;

use App\Models\ActivityLog;
use App\Services\GeoIpService;
use App\Services\LoginSecurityService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SecurityController extends BaseSuperAdminController
{
    public function index(LoginSecurityService $security, GeoIpService $geoIp): JsonResponse
    {
        $lockedAccounts = collect($security->getLockedAccounts())
            ->map(function (array $row) use ($geoIp): array {
                $geo = $geoIp->lookup((string) ($row['ip'] ?? ''));

                return [
                    'email' => (string) ($row['email'] ?? ''),
                    'attempt_count' => (int) ($row['attempt_count'] ?? 0),
                    'ip' => (string) ($row['ip'] ?? ''),
                    'user_agent' => (string) ($row['user_agent'] ?? ''),
                    'device' => (string) ($row['device'] ?? 'Unknown Device'),
                    'seconds_remaining' => (int) ($row['seconds_remaining'] ?? 0),
                    'unlocks_at' => (int) ($row['unlocks_at'] ?? 0),
                    'country_code' => $geo['country_code'] ?? null,
                    'country_name' => $geo['country_name'] ?? 'Unknown',
                    'city' => $geo['city'] ?? '',
                    'isp' => $geo['isp'] ?? '',
                ];
            })
            ->values();

        $blockedIps = collect($security->getBlockedIps())
            ->map(function (array $row) use ($geoIp): array {
                $geo = $geoIp->lookup((string) ($row['ip'] ?? ''));

                return [
                    'ip' => (string) ($row['ip'] ?? ''),
                    'blocked_at' => (string) ($row['blocked_at'] ?? ''),
                    'email' => (string) ($row['email'] ?? ''),
                    'user_agent' => (string) ($row['user_agent'] ?? ''),
                    'device' => (string) ($row['device'] ?? 'Unknown Device'),
                    'country_code' => $geo['country_code'] ?? null,
                    'country_name' => $geo['country_name'] ?? 'Unknown',
                    'city' => $geo['city'] ?? '',
                    'isp' => $geo['isp'] ?? '',
                ];
            })
            ->values();

        return response()->json([
            'data' => [
                'locked_accounts' => $lockedAccounts,
                'blocked_ips' => $blockedIps,
            ],
        ]);
    }

    public function unblockEmail(Request $request, LoginSecurityService $security): JsonResponse
    {
        $validated = $request->validate([
            'email' => ['required', 'email'],
        ]);

        $email = strtolower(trim((string) $validated['email']));
        $security->unblockEmail($email);

        $this->logActivity($request, 'security.unblock_email', sprintf('Unblocked account: %s', $email), [
            'unblocked_email' => $email,
            'admin_id' => $request->user()?->id,
            'admin_ip' => $request->ip(),
        ]);

        return response()->json([
            'message' => 'Account lock cleared.',
        ]);
    }

    public function unblockIp(Request $request, LoginSecurityService $security): JsonResponse
    {
        $validated = $request->validate([
            'ip' => ['required', 'ip'],
        ]);

        $ip = trim((string) $validated['ip']);
        $security->unblockIp($ip);

        $this->logActivity($request, 'security.unblock_ip', sprintf('Unblocked IP: %s', $ip), [
            'unblocked_ip' => $ip,
            'admin_id' => $request->user()?->id,
            'admin_ip' => $request->ip(),
        ]);

        return response()->json([
            'message' => 'IP block removed.',
        ]);
    }

    public function auditLog(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);

        $perPage = (int) ($validated['per_page'] ?? 50);

        $logs = ActivityLog::query()
            ->whereIn('action', ['security.unblock_email', 'security.unblock_ip', 'security.block_ip'])
            ->with('user:id,name,email')
            ->latest()
            ->paginate($perPage);

        return response()->json([
            'data' => collect($logs->items())->map(fn (ActivityLog $log): array => [
                'id' => $log->id,
                'action' => $log->action,
                'description' => $log->description,
                'metadata' => $log->metadata ?? [],
                'admin' => $log->user ? [
                    'id' => $log->user->id,
                    'name' => $log->user->name,
                    'email' => $log->user->email,
                ] : null,
                'admin_ip' => $log->ip_address,
                'created_at' => $log->created_at?->toIso8601String(),
            ])->values(),
            'meta' => $this->paginationMeta($logs),
        ]);
    }

    /**
     * @param array<string, mixed> $metadata
     */
    private function logActivity(Request $request, string $action, string $description, array $metadata = []): void
    {
        ActivityLog::query()->create([
            'tenant_id' => null,
            'user_id' => $request->user()?->id,
            'action' => $action,
            'description' => $description,
            'metadata' => $metadata,
            'ip_address' => $request->ip(),
        ]);
    }
}

