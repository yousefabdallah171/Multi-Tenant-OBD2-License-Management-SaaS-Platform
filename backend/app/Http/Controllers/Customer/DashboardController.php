<?php

namespace App\Http\Controllers\Customer;

use App\Models\License;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class DashboardController extends BaseCustomerController
{
    public function index(Request $request): JsonResponse
    {
        $licenses = $this->customerLicenseQuery($request)
            ->with(['program:id,name,description,version,download_link,icon', 'reseller:id,name'])
            ->latest('activated_at')
            ->get();

        $serialized = $licenses->map(fn (License $license): array => $this->serializeDashboardLicense($license))->values();

        return response()->json([
            'data' => [
                'summary' => [
                    'total_licenses' => $serialized->count(),
                    'active_licenses' => $serialized->where('status', 'active')->count(),
                    'expired_licenses' => $serialized->where('status', 'expired')->count(),
                ],
                'licenses' => $serialized,
            ],
        ]);
    }
}
