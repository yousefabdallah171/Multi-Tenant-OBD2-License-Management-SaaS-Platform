<?php

namespace App\Http\Controllers\Reseller;

use App\Http\Requests\ActivateLicenseRequest;
use App\Http\Requests\RenewLicenseRequest;
use App\Models\ActivityLog;
use App\Models\License;
use App\Services\LicenseService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class LicenseController extends BaseResellerController
{
    public function __construct(private readonly LicenseService $licenseService)
    {
    }

    public function index(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'status' => ['nullable', 'in:active,expired,suspended,pending'],
            'search' => ['nullable', 'string'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);

        $query = $this->licenseQuery($request)
            ->with(['customer:id,name,email', 'program:id,name'])
            ->latest('activated_at');

        if (! empty($validated['status'])) {
            $query->where('status', $validated['status']);
        }

        if (! empty($validated['search'])) {
            $query->where(function ($builder) use ($validated): void {
                $builder
                    ->where('bios_id', 'like', '%'.$validated['search'].'%')
                    ->orWhereHas('customer', function ($customerQuery) use ($validated): void {
                        $customerQuery
                            ->where('name', 'like', '%'.$validated['search'].'%')
                            ->orWhere('email', 'like', '%'.$validated['search'].'%');
                    })
                    ->orWhereHas('program', fn ($programQuery) => $programQuery->where('name', 'like', '%'.$validated['search'].'%'));
            });
        }

        $licenses = $query->paginate((int) ($validated['per_page'] ?? 10));

        return response()->json([
            'data' => collect($licenses->items())->map(fn (License $license): array => $this->serializeLicense($license))->values(),
            'meta' => $this->paginationMeta($licenses),
        ]);
    }

    public function show(Request $request, License $license): JsonResponse
    {
        $resolved = $this->resolveLicense($request, $license);
        $resolved->load(['customer:id,name,email,phone', 'program:id,name,version,download_link']);

        $activity = ActivityLog::query()
            ->where('user_id', $this->currentReseller($request)->id)
            ->where(function ($builder) use ($resolved): void {
                $builder
                    ->where('metadata->license_id', $resolved->id)
                    ->orWhere('metadata->bios_id', $resolved->bios_id);
            })
            ->latest()
            ->limit(10)
            ->get()
            ->map(fn (ActivityLog $entry): array => [
                'id' => $entry->id,
                'action' => $entry->action,
                'description' => $entry->description,
                'created_at' => $entry->created_at?->toIso8601String(),
            ])
            ->values();

        return response()->json([
            'data' => [
                ...$this->serializeLicense($resolved),
                'customer' => $resolved->customer ? [
                    'id' => $resolved->customer->id,
                    'name' => $resolved->customer->name,
                    'email' => $resolved->customer->email,
                    'phone' => $resolved->customer->phone,
                ] : null,
                'program_version' => $resolved->program?->version,
                'download_link' => $resolved->program?->download_link,
                'activity' => $activity,
            ],
        ]);
    }

    public function activate(ActivateLicenseRequest $request): JsonResponse
    {
        $license = $this->licenseService->activate($request->validated());

        return response()->json([
            'message' => 'License activated successfully.',
            'data' => $this->serializeLicense($license),
        ], 201);
    }

    public function renew(Request $request, License $license, RenewLicenseRequest $renewLicenseRequest): JsonResponse
    {
        $resolved = $this->resolveLicense($request, $license);
        $renewed = $this->licenseService->renew($resolved, $renewLicenseRequest->validated());

        return response()->json([
            'message' => 'License renewed successfully.',
            'data' => $this->serializeLicense($renewed),
        ]);
    }

    public function deactivate(Request $request, License $license): JsonResponse
    {
        $resolved = $this->resolveLicense($request, $license);
        $deactivated = $this->licenseService->deactivate($resolved);

        return response()->json([
            'message' => 'License deactivated successfully.',
            'data' => $this->serializeLicense($deactivated),
        ]);
    }

    public function expiring(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'days' => ['nullable', 'integer', 'min:1', 'max:365'],
        ]);

        $days = (int) ($validated['days'] ?? 7);
        $licenses = $this->licenseQuery($request)
            ->with(['customer:id,name,email', 'program:id,name'])
            ->where('status', 'active')
            ->whereBetween('expires_at', [now(), now()->addDays($days)])
            ->orderBy('expires_at')
            ->get();

        return response()->json([
            'data' => $licenses->map(fn (License $license): array => $this->serializeLicense($license))->values(),
        ]);
    }

    public function bulkRenew(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'ids' => ['required', 'array', 'min:1'],
            'ids.*' => ['integer'],
            'duration_days' => ['required', 'integer', 'min:1'],
            'price' => ['required', 'numeric', 'min:0'],
        ]);

        $licenses = $this->licenseQuery($request)->whereIn('id', $validated['ids'])->get();

        foreach ($licenses as $license) {
            $this->licenseService->renew($license, [
                'duration_days' => (int) $validated['duration_days'],
                'price' => (float) $validated['price'],
            ]);
        }

        return response()->json([
            'message' => 'Selected licenses renewed successfully.',
            'count' => $licenses->count(),
        ]);
    }

    public function bulkDeactivate(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'ids' => ['required', 'array', 'min:1'],
            'ids.*' => ['integer'],
        ]);

        $licenses = $this->licenseQuery($request)->whereIn('id', $validated['ids'])->get();

        foreach ($licenses as $license) {
            $this->licenseService->deactivate($license);
        }

        return response()->json([
            'message' => 'Selected licenses deactivated successfully.',
            'count' => $licenses->count(),
        ]);
    }

    private function serializeLicense(License $license): array
    {
        $license->loadMissing(['customer:id,name,email', 'program:id,name']);

        return [
            'id' => $license->id,
            'customer_id' => $license->customer_id,
            'customer_name' => $license->customer?->name,
            'customer_email' => $license->customer?->email,
            'bios_id' => $license->bios_id,
            'program' => $license->program?->name,
            'program_id' => $license->program_id,
            'duration_days' => $license->duration_days,
            'price' => (float) $license->price,
            'activated_at' => $license->activated_at?->toIso8601String(),
            'expires_at' => $license->expires_at?->toIso8601String(),
            'status' => $license->status,
        ];
    }
}
