<?php

namespace App\Http\Controllers;

use App\Models\License;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use App\Services\LicenseService;

class LicenseController extends Controller
{
    public function __construct(private readonly LicenseService $licenseService)
    {
    }

    public function activateLicense(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'program_id' => ['required', 'integer'],
            'customer_name' => ['required', 'string', 'max:255'],
            'customer_email' => ['required', 'email', 'max:255'],
            'bios_id' => ['required', 'string', 'max:255'],
            'duration_days' => ['required', 'numeric', 'min:0.014'],
            'price' => ['required', 'numeric', 'min:0'],
        ]);

        $license = $this->licenseService->activate($validated);
        $licenseKey = Str::upper('LIC-'.$license->id.'-'.Str::random(8));

        return response()->json([
            'message' => 'License activated.',
            'license_key' => $licenseKey,
            'customer_id' => $license->customer_id,
            'expires_at' => $license->expires_at?->toIso8601String(),
            'data' => [
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
            ],
        ], 201);
    }

}
