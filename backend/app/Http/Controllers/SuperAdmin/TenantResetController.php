<?php

namespace App\Http\Controllers\SuperAdmin;

use App\Models\Tenant;
use App\Models\TenantBackup;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Throwable;

class TenantResetController extends BaseSuperAdminController
{
    // -------------------------------------------------------------------------
    // Public endpoints
    // -------------------------------------------------------------------------

    /**
     * List all backups for a tenant (no payload — lightweight).
     */
    public function index(Tenant $tenant): JsonResponse
    {
        $backups = TenantBackup::query()
            ->where('tenant_id', $tenant->id)
            ->with('creator:id,name,email')
            ->latest()
            ->get()
            ->map(fn (TenantBackup $backup): array => $this->serializeBackup($backup));

        return response()->json(['data' => $backups]);
    }

    /**
     * Reset tenant: snapshot all operational data then wipe it.
     */
    public function reset(Request $request, Tenant $tenant): JsonResponse
    {
        $validated = $request->validate([
            'label'        => ['nullable', 'string', 'max:255'],
            'confirm_name' => ['required', 'string'],
        ]);

        if ($validated['confirm_name'] !== $tenant->name) {
            return response()->json([
                'message' => 'Tenant name confirmation does not match.',
                'errors'  => ['confirm_name' => ['Tenant name confirmation does not match.']],
            ], 422);
        }

        $backup = DB::transaction(function () use ($request, $tenant, $validated): TenantBackup {
            $customerIds   = $this->customerIds($tenant->id);
            $commissionIds = $this->commissionIds($tenant->id);

            [$payload, $stats] = $this->buildPayloadJson($tenant->id, $customerIds, $commissionIds);

            $backup = TenantBackup::query()->create([
                'tenant_id'  => $tenant->id,
                'created_by' => $request->user()->id,
                'label'      => $validated['label'] ?? null,
                'stats'      => $stats,
                'payload'    => $payload,
            ]);

            $this->deleteOperationalData($tenant->id, $customerIds, $commissionIds);

            return $backup;
        });

        return response()->json([
            'message' => 'Tenant reset successfully. Backup created.',
            'data'    => $this->serializeBackup($backup->load('creator:id,name,email')),
        ]);
    }

    /**
     * Restore tenant from a stored backup.
     */
    public function restore(Request $request, Tenant $tenant, TenantBackup $backup): JsonResponse
    {
        if ($backup->tenant_id !== $tenant->id) {
            return response()->json(['message' => 'Backup does not belong to this tenant.'], 403);
        }

        $validated = $request->validate([
            'confirm_name' => ['required', 'string'],
        ]);

        if ($validated['confirm_name'] !== $tenant->name) {
            return response()->json([
                'message' => 'Tenant name confirmation does not match.',
                'errors'  => ['confirm_name' => ['Tenant name confirmation does not match.']],
            ], 422);
        }

        $payload = json_decode($backup->payload, true);

        DB::transaction(function () use ($tenant, $payload): void {
            $currentCustomerIds   = $this->customerIds($tenant->id);
            $currentCommissionIds = $this->commissionIds($tenant->id);

            $this->deleteOperationalData($tenant->id, $currentCustomerIds, $currentCommissionIds);
            $this->insertPayload($payload);
        });

        return response()->json(['message' => 'Tenant data restored successfully from backup.']);
    }

    /**
     * Download a backup as a JSON file.
     */
    public function download(Tenant $tenant, TenantBackup $backup): Response
    {
        if ($backup->tenant_id !== $tenant->id) {
            abort(403, 'Backup does not belong to this tenant.');
        }

        $payload = json_decode($backup->payload, true);

        $export = [
            'version'    => 2,
            'exported_at' => now()->toIso8601String(),
            'tenant'     => [
                'id'   => $tenant->id,
                'name' => $tenant->name,
                'slug' => $tenant->slug,
            ],
            'backup' => [
                'id'         => $backup->id,
                'label'      => $backup->label,
                'stats'      => $backup->stats,
                'created_at' => $backup->created_at?->toIso8601String(),
                'created_by' => $backup->creator?->name,
            ],
            'data' => $payload,
        ];

        $filename = sprintf(
            'backup-%s-%s.json',
            str_replace(' ', '-', strtolower($tenant->name)),
            $backup->created_at?->format('Ymd-His') ?? 'unknown'
        );

        return response(json_encode($export, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT), 200, [
            'Content-Type'        => 'application/json',
            'Content-Disposition' => "attachment; filename=\"{$filename}\"",
        ]);
    }

    /**
     * Import a backup JSON file and store it as a backup (without restoring).
     */
    public function import(Request $request, Tenant $tenant): JsonResponse
    {
        $request->validate([
            'file'  => ['required', 'file', 'mimetypes:application/json,text/plain,application/octet-stream', 'max:102400'],
            'label' => ['nullable', 'string', 'max:255'],
        ]);

        $contents = file_get_contents($request->file('file')->getRealPath());

        if ($contents === false) {
            return response()->json(['message' => 'Could not read the uploaded file.'], 422);
        }

        $decoded = json_decode($contents, true);

        if (json_last_error() !== JSON_ERROR_NONE) {
            return response()->json(['message' => 'Invalid JSON file.'], 422);
        }

        // Support both raw payload and wrapped export format (version 2)
        if (isset($decoded['data']) && isset($decoded['version'])) {
            $payload = $decoded['data'];
        } elseif (isset($decoded['customers']) || isset($decoded['licenses'])) {
            $payload = $decoded;
        } else {
            return response()->json(['message' => 'Unrecognized backup file format.'], 422);
        }

        $this->normalizePayload($payload);

        $stats = [
            'customers'            => count($payload['customers'] ?? []),
            'licenses'             => count($payload['licenses'] ?? []),
            'bios_change_requests' => count($payload['bios_change_requests'] ?? []),
            'bios_access_logs'     => count($payload['bios_access_logs'] ?? []),
            'bios_conflicts'       => count($payload['bios_conflicts'] ?? []),
            'activity_logs'        => count($payload['activity_logs'] ?? []),
            'api_logs'             => count($payload['api_logs'] ?? []),
            'user_ip_logs'         => count($payload['user_ip_logs'] ?? []),
            'reseller_commissions' => count($payload['reseller_commissions'] ?? []),
            'reseller_payments'    => count($payload['reseller_payments'] ?? []),
            'financial_reports'    => count($payload['financial_reports'] ?? []),
            'user_balances'        => count($payload['user_balances'] ?? []),
        ];

        $label = $request->input('label')
            ?? ($decoded['backup']['label'] ?? null)
            ?? 'Imported backup';

        $backup = TenantBackup::query()->create([
            'tenant_id'  => $tenant->id,
            'created_by' => $request->user()->id,
            'label'      => $label,
            'stats'      => $stats,
            'payload'    => json_encode($payload, JSON_UNESCAPED_UNICODE),
        ]);

        return response()->json([
            'message' => 'Backup imported successfully. You can now restore from it.',
            'data'    => $this->serializeBackup($backup->load('creator:id,name,email')),
        ], 201);
    }

    /**
     * Delete a specific backup.
     */
    public function destroy(Tenant $tenant, TenantBackup $backup): JsonResponse
    {
        if ($backup->tenant_id !== $tenant->id) {
            return response()->json(['message' => 'Backup does not belong to this tenant.'], 403);
        }

        $backup->delete();

        return response()->json(['message' => 'Backup deleted.']);
    }

    // -------------------------------------------------------------------------
    // Private helpers
    // -------------------------------------------------------------------------

    /** @return list<int> */
    private function customerIds(int $tenantId): array
    {
        return DB::table('users')
            ->where('tenant_id', $tenantId)
            ->where('role', 'customer')
            ->pluck('id')
            ->toArray();
    }

    /** @return list<int> */
    private function commissionIds(int $tenantId): array
    {
        return DB::table('reseller_commissions')
            ->where('tenant_id', $tenantId)
            ->pluck('id')
            ->toArray();
    }

    /**
     * Build the backup JSON payload without materializing the full dataset in PHP memory.
     *
     * @param list<int> $customerIds
     * @param list<int> $commissionIds
     * @return array{0:string,1:array<string,int>}
     */
    private function buildPayloadJson(int $tenantId, array $customerIds, array $commissionIds): array
    {
        $path = tempnam(sys_get_temp_dir(), 'tenant-backup-');

        if ($path === false) {
            throw new \RuntimeException('Could not allocate a temporary file for tenant backup.');
        }

        $handle = fopen($path, 'wb');

        if ($handle === false) {
            @unlink($path);
            throw new \RuntimeException('Could not open the temporary tenant backup file for writing.');
        }

        $stats = [];

        $specs = [
            'customers' => [
                'query' => fn () => DB::table('users')->where('tenant_id', $tenantId)->where('role', 'customer'),
                'order' => 'id',
            ],
            'licenses' => [
                'query' => fn () => DB::table('licenses')->where('tenant_id', $tenantId),
                'order' => 'id',
            ],
            'bios_change_requests' => [
                'query' => fn () => DB::table('bios_change_requests')->where('tenant_id', $tenantId),
                'order' => 'id',
            ],
            'bios_access_logs' => [
                'query' => fn () => DB::table('bios_access_logs')->where('tenant_id', $tenantId),
                'order' => 'id',
            ],
            'bios_conflicts' => [
                'query' => fn () => DB::table('bios_conflicts')->where('tenant_id', $tenantId),
                'order' => 'id',
            ],
            'activity_logs' => [
                'query' => fn () => DB::table('activity_logs')->where('tenant_id', $tenantId),
                'order' => 'id',
            ],
            'api_logs' => [
                'query' => fn () => DB::table('api_logs')->where('tenant_id', $tenantId),
                'order' => 'id',
            ],
            'user_ip_logs' => [
                'query' => fn () => empty($customerIds) ? null : DB::table('user_ip_logs')->whereIn('user_id', $customerIds),
                'order' => 'id',
            ],
            'user_balances' => [
                'query' => fn () => empty($customerIds) ? null : DB::table('user_balances')->whereIn('user_id', $customerIds),
                'order' => 'id',
            ],
            'user_online_statuses' => [
                'query' => fn () => empty($customerIds) ? null : DB::table('user_online_status')->whereIn('user_id', $customerIds),
                'order' => 'user_id',
            ],
            'reseller_commissions' => [
                'query' => fn () => DB::table('reseller_commissions')->where('tenant_id', $tenantId),
                'order' => 'id',
            ],
            'reseller_payments' => [
                'query' => fn () => empty($commissionIds) ? null : DB::table('reseller_payments')->whereIn('commission_id', $commissionIds),
                'order' => 'id',
            ],
            'financial_reports' => [
                'query' => fn () => DB::table('financial_reports')->where('tenant_id', $tenantId),
                'order' => 'id',
            ],
        ];

        try {
            fwrite($handle, '{');

            $firstSection = true;

            foreach ($specs as $key => $spec) {
                if (! $firstSection) {
                    fwrite($handle, ',');
                }

                $firstSection = false;
                fwrite($handle, json_encode($key, JSON_UNESCAPED_UNICODE) . ':[');

                $query = $spec['query']();
                $count = 0;
                $firstRow = true;

                Log::info('tenant-backup table start', ['tenant_id' => $tenantId, 'table' => $key]);

                if ($query !== null) {
                    foreach ($query->orderBy($spec['order'])->cursor() as $row) {
                        if (! $firstRow) {
                            fwrite($handle, ',');
                        }

                        $firstRow = false;
                        fwrite($handle, json_encode((array) $row, JSON_UNESCAPED_UNICODE));
                        $count++;
                    }
                }

                fwrite($handle, ']');
                $stats[$key] = $count;

                Log::info('tenant-backup table complete', [
                    'tenant_id' => $tenantId,
                    'table' => $key,
                    'rows' => $count,
                ]);
            }

            fwrite($handle, '}');
            fclose($handle);

            $payload = file_get_contents($path);

            if ($payload === false) {
                throw new \RuntimeException('Could not read the generated tenant backup payload.');
            }

            return [$payload, $stats];
        } catch (Throwable $e) {
            if (is_resource($handle)) {
                fclose($handle);
            }
            @unlink($path);

            throw $e;
        } finally {
            @unlink($path);
        }
    }

    /**
     * Delete all operational data for a tenant in safe dependency order.
     *
     * @param list<int> $customerIds
     * @param list<int> $commissionIds
     */
    private function deleteOperationalData(int $tenantId, array $customerIds, array $commissionIds): void
    {
        if (! empty($commissionIds)) {
            DB::table('reseller_payments')->whereIn('commission_id', $commissionIds)->delete();
        }
        DB::table('reseller_commissions')->where('tenant_id', $tenantId)->delete();
        DB::table('bios_change_requests')->where('tenant_id', $tenantId)->delete();
        DB::table('bios_access_logs')->where('tenant_id', $tenantId)->delete();
        DB::table('bios_conflicts')->where('tenant_id', $tenantId)->delete();
        DB::table('activity_logs')->where('tenant_id', $tenantId)->delete();
        DB::table('api_logs')->where('tenant_id', $tenantId)->delete();
        DB::table('financial_reports')->where('tenant_id', $tenantId)->delete();

        if (! empty($customerIds)) {
            DB::table('user_ip_logs')->whereIn('user_id', $customerIds)->delete();
            DB::table('user_balances')->whereIn('user_id', $customerIds)->delete();
            DB::table('user_online_status')->whereIn('user_id', $customerIds)->delete();
        }

        DB::table('licenses')->where('tenant_id', $tenantId)->delete();

        if (! empty($customerIds)) {
            DB::table('users')->whereIn('id', $customerIds)->delete();
        }
    }

    /**
     * Insert payload data in correct order (parents before children).
     *
     * @param array<string, list<array<string, mixed>>> $payload
     */
    private function insertPayload(array $payload): void
    {
        $this->restoreRows('users', $payload['customers'] ?? []);
        $this->restoreRows('licenses', $payload['licenses'] ?? []);
        $this->restoreRows('bios_change_requests', $payload['bios_change_requests'] ?? []);
        $this->restoreRows('bios_access_logs', $payload['bios_access_logs'] ?? []);
        $this->restoreRows('bios_conflicts', $payload['bios_conflicts'] ?? []);
        $this->restoreRows('activity_logs', $payload['activity_logs'] ?? []);
        $this->restoreRows('api_logs', $payload['api_logs'] ?? []);
        $this->restoreRows('user_ip_logs', $payload['user_ip_logs'] ?? []);
        $this->restoreRows('user_balances', $payload['user_balances'] ?? []);
        $this->restoreRows('user_online_status', $payload['user_online_statuses'] ?? []);
        $this->restoreRows('reseller_commissions', $payload['reseller_commissions'] ?? []);
        $this->restoreRows('reseller_payments', $payload['reseller_payments'] ?? []);
        $this->restoreRows('financial_reports', $payload['financial_reports'] ?? []);
    }

    /**
     * Re-insert rows into a table with automatic type normalization:
     * - PHP arrays → JSON string
     * - ISO 8601 datetimes → MySQL datetime format
     *
     * @param list<array<string, mixed>> $rows
     */
    private function restoreRows(string $table, array $rows): void
    {
        if (empty($rows)) {
            return;
        }

        $rows = array_map(function (array $row): array {
            foreach ($row as $key => $value) {
                if (is_array($value)) {
                    $row[$key] = json_encode($value, JSON_UNESCAPED_UNICODE);
                } elseif (is_string($value) && preg_match('/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/', $value)) {
                    // Convert ISO 8601 (from old Eloquent-based backups) → MySQL datetime
                    try {
                        $row[$key] = (new \DateTime($value))->format('Y-m-d H:i:s');
                    } catch (\Exception) {
                        // Leave as-is if unparseable
                    }
                }
            }

            return $row;
        }, $rows);

        foreach (array_chunk($rows, 200) as $chunk) {
            DB::table($table)->insert($chunk);
        }
    }

    /**
     * Normalize an imported payload:
     * - Ensure tenant_id on all records matches the target tenant (done later at restore time, not here)
     * - Unify key name: user_online_statuses / user_online_status
     */
    private function normalizePayload(array &$payload): void
    {
        // Normalise the online-status key regardless of which variant was used
        if (! isset($payload['user_online_statuses']) && isset($payload['user_online_status'])) {
            $payload['user_online_statuses'] = $payload['user_online_status'];
            unset($payload['user_online_status']);
        }
    }

    private function serializeBackup(TenantBackup $backup): array
    {
        return [
            'id'         => $backup->id,
            'tenant_id'  => $backup->tenant_id,
            'label'      => $backup->label,
            'stats'      => $backup->stats,
            'created_by' => $backup->creator ? [
                'id'    => $backup->creator->id,
                'name'  => $backup->creator->name,
                'email' => $backup->creator->email,
            ] : null,
            'created_at' => $backup->created_at?->toIso8601String(),
        ];
    }
}
