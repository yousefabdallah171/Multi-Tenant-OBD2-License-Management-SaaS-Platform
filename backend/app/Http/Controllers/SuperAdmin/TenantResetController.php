<?php

namespace App\Http\Controllers\SuperAdmin;

use App\Models\License;
use App\Models\Program;
use App\Models\Tenant;
use App\Models\TenantBackup;
use App\Services\ExternalApiService;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Throwable;
use Illuminate\Validation\ValidationException;

class TenantResetController extends BaseSuperAdminController
{
    public function __construct(
        private readonly ExternalApiService $externalApiService,
    ) {
    }

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

        $externalDeactivationPlan = $this->buildCurrentExternalActivationPlan($tenant->id);

        $this->executeExternalSyncPlan($externalDeactivationPlan, 'deactivate', 'tenant-reset');

        try {
            $backup = DB::transaction(function () use ($request, $tenant, $validated): TenantBackup {
                $customerIds   = $this->customerIds($tenant->id);
                $commissionIds = $this->commissionIds($tenant->id);

                [$payload, $stats] = $this->buildPayloadJson($tenant->id, $customerIds, $commissionIds);
                $storedPayload = $this->encodePayloadForStorage($payload);

                $backup = TenantBackup::query()->create([
                    'tenant_id'  => $tenant->id,
                    'created_by' => $request->user()->id,
                    'label'      => $validated['label'] ?? null,
                    'stats'      => $stats,
                    'payload'    => $storedPayload,
                ]);

                $this->deleteOperationalData($tenant->id, $customerIds, $commissionIds);

                return $backup;
            });
        } catch (Throwable $e) {
            $this->rollbackExternalSyncPlan($externalDeactivationPlan, 'activate', 'tenant-reset');
            throw $e;
        }

        return response()->json([
            'message' => 'Tenant reset successfully. Backup created.',
            'data'    => $this->serializeBackup($backup->load('creator:id,name,email')),
        ]);
    }

    /**
     * Create a backup of current tenant data without resetting.
     */
    public function create(Request $request, Tenant $tenant): JsonResponse
    {
        $validated = $request->validate([
            'label' => ['nullable', 'string', 'max:255'],
        ]);

        try {
            $backup = DB::transaction(function () use ($request, $tenant, $validated): TenantBackup {
                $customerIds   = $this->customerIds($tenant->id);
                $commissionIds = $this->commissionIds($tenant->id);

                [$payload, $stats] = $this->buildPayloadJson($tenant->id, $customerIds, $commissionIds);
                $storedPayload = $this->encodePayloadForStorage($payload);

                $backup = TenantBackup::query()->create([
                    'tenant_id'  => $tenant->id,
                    'created_by' => $request->user()->id,
                    'label'      => $validated['label'] ?? null,
                    'stats'      => $stats,
                    'payload'    => $storedPayload,
                ]);

                return $backup;
            });
        } catch (Throwable $e) {
            Log::error('Backup creation failed', ['tenant_id' => $tenant->id, 'error' => $e->getMessage()]);
            throw $e;
        }

        return response()->json([
            'message' => 'Backup created successfully.',
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

        $payload = $this->decodeStoredPayload($backup->payload);
        $this->normalizePayload($payload);

        $currentDeactivationPlan = $this->buildCurrentExternalActivationPlan($tenant->id);
        $restoreActivationPlan = $this->buildRestoreExternalActivationPlan($tenant->id, $payload);
        $restorePreparePlan = $this->mergeExternalPlans(
            $currentDeactivationPlan,
            $this->buildPrecleanDeactivationPlan($restoreActivationPlan),
        );

        $this->executeExternalSyncPlan($restorePreparePlan, 'deactivate', 'tenant-restore-prepare');

        try {
            DB::transaction(function () use ($tenant, $payload): void {
                $currentCustomerIds   = $this->customerIds($tenant->id);
                $currentCommissionIds = $this->commissionIds($tenant->id);

                $this->deleteOperationalData($tenant->id, $currentCustomerIds, $currentCommissionIds);
                $this->insertPayload($payload);
            });
        } catch (Throwable $e) {
            $this->rollbackExternalSyncPlan($currentDeactivationPlan, 'activate', 'tenant-restore');
            throw $e;
        }

        $this->executeExternalSyncPlan($restoreActivationPlan, 'activate', 'tenant-restore');

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

        $payload = $this->decodeStoredPayload($backup->payload);

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

        $encodedPayload = $this->encodePayloadForStorage(json_encode($payload, JSON_UNESCAPED_UNICODE));

        $backup = TenantBackup::query()->create([
            'tenant_id'  => $tenant->id,
            'created_by' => $request->user()->id,
            'label'      => $label,
            'stats'      => $stats,
            'payload'    => $encodedPayload,
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
            'bios_blacklist' => [
                'query' => fn () => DB::table('bios_blacklist')->where('tenant_id', $tenantId),
                'order' => 'id',
            ],
            'bios_username_links' => [
                'query' => fn () => DB::table('bios_username_links')->where('tenant_id', $tenantId),
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
                    foreach ($this->streamBackupRows($query, $spec['order']) as $row) {
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

            Log::info('tenant-backup payload built', [
                'tenant_id' => $tenantId,
                'bytes' => strlen($payload),
            ]);

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

    private function encodePayloadForStorage(string $payload): string
    {
        $compressed = gzencode($payload, 6);

        if ($compressed === false) {
            throw new \RuntimeException('Could not compress the tenant backup payload.');
        }

        $envelope = json_encode([
            'encoding' => 'gzip_base64',
            'data' => base64_encode($compressed),
        ], JSON_UNESCAPED_UNICODE);

        if ($envelope === false) {
            throw new \RuntimeException('Could not encode the compressed tenant backup payload.');
        }

        Log::info('tenant-backup payload compressed', [
            'raw_bytes' => strlen($payload),
            'stored_bytes' => strlen($envelope),
        ]);

        return $envelope;
    }

    /**
     * Stream backup rows without explicit ordering.
     *
     * Tenant reset/restore only requires a complete payload, not deterministic row
     * order. Explicit `ORDER BY` clauses were triggering MySQL sort-buffer failures
     * on larger tenant tables such as `api_logs`, so backups intentionally stream
     * rows in natural database order instead.
     */
    private function streamBackupRows(\Illuminate\Database\Query\Builder $query, string $orderColumn): iterable
    {
        yield from $query->cursor();
    }

    /**
     * @return array<string, mixed>
     */
    private function decodeStoredPayload(string $storedPayload): array
    {
        $decoded = json_decode($storedPayload, true);

        if (! is_array($decoded)) {
            throw new \RuntimeException('Stored tenant backup payload is not valid JSON.');
        }

        if (($decoded['encoding'] ?? null) === 'gzip_base64' && isset($decoded['data']) && is_string($decoded['data'])) {
            $binary = base64_decode($decoded['data'], true);

            if ($binary === false) {
                throw new \RuntimeException('Stored tenant backup payload has invalid base64 data.');
            }

            $json = gzdecode($binary);

            if ($json === false) {
                throw new \RuntimeException('Stored tenant backup payload could not be decompressed.');
            }

            $payload = json_decode($json, true);

            if (! is_array($payload)) {
                throw new \RuntimeException('Decompressed tenant backup payload is not valid JSON.');
            }

            return $payload;
        }

        return $decoded;
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
        DB::table('bios_blacklist')->where('tenant_id', $tenantId)->delete();
        DB::table('bios_username_links')->where('tenant_id', $tenantId)->delete();

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
        $this->restoreRows('bios_blacklist', $payload['bios_blacklist'] ?? []);
        $this->restoreRows('bios_username_links', $payload['bios_username_links'] ?? []);
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

        Log::info('tenant-backup restore start', [
            'table' => $table,
            'rows' => count($rows),
        ]);

        $settings = $this->restoreChunkSettings($table);
        $chunk = [];
        $chunkBytes = 0;
        $inserted = 0;

        foreach ($rows as $row) {
            $rowJson = json_encode($row, JSON_UNESCAPED_UNICODE);
            $rowBytes = is_string($rowJson) ? strlen($rowJson) : 0;

            if (! empty($chunk)
                && (count($chunk) >= $settings['max_rows'] || ($chunkBytes + $rowBytes) > $settings['max_bytes'])) {
                DB::table($table)->insert($chunk);
                $inserted += count($chunk);
                $chunk = [];
                $chunkBytes = 0;
            }

            $chunk[] = $row;
            $chunkBytes += $rowBytes;
        }

        if (! empty($chunk)) {
            DB::table($table)->insert($chunk);
            $inserted += count($chunk);
        }

        Log::info('tenant-backup restore complete', [
            'table' => $table,
            'rows' => $inserted,
        ]);
    }

    /**
     * @return array{max_rows:int,max_bytes:int}
     */
    private function restoreChunkSettings(string $table): array
    {
        return match ($table) {
            'api_logs', 'activity_logs', 'bios_access_logs' => [
                'max_rows' => 10,
                'max_bytes' => 512 * 1024,
            ],
            default => [
                'max_rows' => 100,
                'max_bytes' => 1024 * 1024,
            ],
        };
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

    /**
     * @return list<array{
     *   program_id:int,
     *   program_name:string,
     *   api_key:string,
     *   base_url:?string,
     *   external_username:string,
     *   bios_id:string,
     *   license_id:?int,
     *   status:string
     * }>
     */
    private function buildCurrentExternalActivationPlan(int $tenantId): array
    {
        $licenses = License::query()
            ->where('tenant_id', $tenantId)
            ->whereEffectivelyActive()
            ->with([
                'program:id,name,external_api_key_encrypted,external_api_base_url,external_software_id',
                'customer:id,username',
            ])
            ->get();

        $plan = [];

        foreach ($licenses as $license) {
            $item = $this->buildExternalSyncItem(
                $license->program,
                $license->external_username ?: $license->customer?->username ?: $license->bios_id,
                (string) $license->bios_id,
                $license->id,
                (string) $license->status,
            );

            if ($item !== null) {
                $plan[] = $item;
            }
        }

        return $this->deduplicateExternalPlan($plan, includeBios: true);
    }

    /**
     * @param array<string, list<array<string, mixed>>> $payload
     * @return list<array{
     *   program_id:int,
     *   program_name:string,
     *   api_key:string,
     *   base_url:?string,
     *   external_username:string,
     *   bios_id:string,
     *   license_id:?int,
     *   status:string
     * }>
     */
    private function buildRestoreExternalActivationPlan(int $tenantId, array $payload): array
    {
        $licenses = $payload['licenses'] ?? [];

        if ($licenses === []) {
            return [];
        }

        $programIds = array_values(array_unique(array_map(
            static fn (array $license): int => (int) ($license['program_id'] ?? 0),
            $licenses
        )));

        $programs = Program::query()
            ->where('tenant_id', $tenantId)
            ->whereIn('id', array_filter($programIds))
            ->get()
            ->keyBy('id');

        $customerUsernames = collect($payload['customers'] ?? [])
            ->filter(static fn (array $customer): bool => isset($customer['id']))
            ->mapWithKeys(static fn (array $customer): array => [
                (int) $customer['id'] => (string) ($customer['username'] ?? ''),
            ]);

        $plan = [];

        foreach ($licenses as $license) {
            if (! $this->licensePayloadShouldBeExternallyActive($license)) {
                continue;
            }

            $program = $programs->get((int) ($license['program_id'] ?? 0));
            $externalUsername = trim((string) (
                $license['external_username']
                ?? $customerUsernames->get((int) ($license['customer_id'] ?? 0))
                ?? ($license['bios_id'] ?? '')
            ));

            $item = $this->buildExternalSyncItem(
                $program,
                $externalUsername,
                (string) ($license['bios_id'] ?? ''),
                isset($license['id']) ? (int) $license['id'] : null,
                (string) ($license['status'] ?? '')
            );

            if ($item !== null) {
                $plan[] = $item;
            }
        }

        return $this->deduplicateExternalPlan($plan, includeBios: true);
    }

    /**
     * @param list<array<string, mixed>> $activationPlan
     * @return list<array<string, mixed>>
     */
    private function buildPrecleanDeactivationPlan(array $activationPlan): array
    {
        return $this->deduplicateExternalPlan($activationPlan, includeBios: false);
    }

    /**
     * @param list<array<string, mixed>> $plans
     * @return list<array<string, mixed>>
     */
    private function mergeExternalPlans(array ...$plans): array
    {
        $merged = [];

        foreach ($plans as $plan) {
            array_push($merged, ...$plan);
        }

        return $this->deduplicateExternalPlan($merged, includeBios: false);
    }

    /**
     * @param list<array<string, mixed>> $plan
     */
    private function executeExternalSyncPlan(array $plan, string $operation, string $context): void
    {
        if ($plan === []) {
            return;
        }

        $failures = [];

        foreach ($plan as $item) {
            $response = $operation === 'activate'
                ? $this->externalApiService->activateUser($item['api_key'], $item['external_username'], $item['bios_id'], $item['base_url'])
                : $this->externalApiService->deactivateUser($item['api_key'], $item['external_username'], $item['base_url']);

            if ($operation === 'deactivate' && ! ($response['success'] ?? false) && $this->externalUserIsAlreadyAbsent($item)) {
                Log::info('tenant-external-sync treated as already absent', [
                    'context' => $context,
                    'program_id' => $item['program_id'],
                    'license_id' => $item['license_id'],
                    'external_username' => $item['external_username'],
                ]);

                $response = [
                    'success' => true,
                    'data' => ['message' => 'User already absent from external API.'],
                    'status_code' => 200,
                ];
            }

            Log::info('tenant-external-sync attempt', [
                'context' => $context,
                'operation' => $operation,
                'tenant_id' => request()->route('tenant')?->id,
                'program_id' => $item['program_id'],
                'license_id' => $item['license_id'],
                'external_username' => $item['external_username'],
                'bios_id' => $item['bios_id'],
                'success' => (bool) ($response['success'] ?? false),
                'status_code' => $response['status_code'] ?? null,
            ]);

            if (! ($response['success'] ?? false)) {
                $failures[] = sprintf(
                    '%s failed for %s on %s: %s',
                    ucfirst($operation),
                    $item['external_username'],
                    $item['program_name'],
                    $this->extractExternalSyncMessage($response, $operation)
                );
            }
        }

        if ($failures !== []) {
            throw ValidationException::withMessages(['external_api' => $failures]);
        }
    }

    /**
     * @param list<array<string, mixed>> $plan
     */
    private function rollbackExternalSyncPlan(array $plan, string $operation, string $context): void
    {
        foreach ($plan as $item) {
            if ($operation === 'activate' && $item['bios_id'] === '') {
                continue;
            }

            $response = $operation === 'activate'
                ? $this->externalApiService->activateUser($item['api_key'], $item['external_username'], $item['bios_id'], $item['base_url'])
                : $this->externalApiService->deactivateUser($item['api_key'], $item['external_username'], $item['base_url']);

            Log::warning('tenant-external-sync rollback', [
                'context' => $context,
                'operation' => $operation,
                'program_id' => $item['program_id'],
                'license_id' => $item['license_id'],
                'external_username' => $item['external_username'],
                'bios_id' => $item['bios_id'],
                'success' => (bool) ($response['success'] ?? false),
                'status_code' => $response['status_code'] ?? null,
            ]);
        }
    }

    /**
     * @param list<array<string, mixed>> $plan
     * @return list<array<string, mixed>>
     */
    private function deduplicateExternalPlan(array $plan, bool $includeBios): array
    {
        $deduplicated = [];

        foreach ($plan as $item) {
            $key = implode('|', [
                (string) $item['program_id'],
                (string) $item['external_username'],
                $includeBios ? (string) $item['bios_id'] : '',
            ]);

            $deduplicated[$key] = $item;
        }

        return array_values($deduplicated);
    }

    /**
     * @return array{
     *   program_id:int,
     *   program_name:string,
     *   api_key:string,
     *   base_url:?string,
     *   external_username:string,
     *   bios_id:string,
     *   license_id:?int,
     *   status:string
     * }|null
     */
    private function buildExternalSyncItem(?Program $program, string $externalUsername, string $biosId, ?int $licenseId, string $status): ?array
    {
        $username = trim($externalUsername);
        $apiKey = $program?->getDecryptedApiKey();

        if ($program === null || $username === '' || $apiKey === null) {
            return null;
        }

        return [
            'program_id' => (int) $program->id,
            'program_name' => (string) $program->name,
            'api_key' => $apiKey,
            'base_url' => $program->external_api_base_url,
            'software_id' => $program->external_software_id ? (int) $program->external_software_id : null,
            'external_username' => $username,
            'bios_id' => trim($biosId),
            'license_id' => $licenseId,
            'status' => $status,
        ];
    }

    /**
     * @param array<string, mixed> $license
     */
    private function licensePayloadShouldBeExternallyActive(array $license): bool
    {
        if (($license['status'] ?? null) !== 'active') {
            return false;
        }

        $expiresAt = $this->parseBackupDateTime($license['expires_at'] ?? null);

        if ($expiresAt !== null && $expiresAt->lt(now()->startOfMinute()->addMinute())) {
            return false;
        }

        return true;
    }

    private function parseBackupDateTime(mixed $value): ?Carbon
    {
        if (! is_string($value) || trim($value) === '') {
            return null;
        }

        try {
            return Carbon::parse($value);
        } catch (Throwable) {
            return null;
        }
    }

    /**
     * @param array<string, mixed> $response
     */
    private function extractExternalSyncMessage(array $response, string $operation): string
    {
        $message = $response['data']['message']
            ?? $response['data']['error']
            ?? $response['data']['response']
            ?? $response['data']['raw_message']
            ?? null;

        if (is_string($message) && trim($message) !== '') {
            $clean = trim(preg_replace('/\s+/', ' ', strip_tags($message)) ?? '');

            if ($clean !== '') {
                return $clean;
            }
        }

        return $operation === 'activate'
            ? 'The external software activation was rejected.'
            : 'The external software deletion was rejected.';
    }

    /**
     * @param array{software_id:?int,external_username:string,base_url:?string} $item
     */
    private function externalUserIsAlreadyAbsent(array $item): bool
    {
        if (($item['software_id'] ?? null) === null) {
            return false;
        }

        $verification = $this->externalApiService->getActiveUsers((int) $item['software_id'], $item['base_url']);

        if (! ($verification['success'] ?? false)) {
            return false;
        }

        $users = $verification['data']['users'] ?? null;

        return is_array($users) && ! array_key_exists($item['external_username'], $users);
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
