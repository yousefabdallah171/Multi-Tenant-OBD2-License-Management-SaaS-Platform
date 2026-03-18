<?php

namespace App\Http\Controllers;

use App\Models\BiosBlacklist;
use App\Models\BiosUsernameLink;
use App\Models\License;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class BiosAvailabilityController extends Controller
{
    /**
     * Check BIOS ID availability across all tenants
     */
    public function checkBios(Request $request): JsonResponse
    {
        $biosId = strtolower(trim($request->query('bios_id', '')));

        if (strlen($biosId) < 3) {
            return response()->json([
                'available' => false,
                'linked_username' => null,
                'is_blacklisted' => false,
                'message' => 'BIOS ID must be at least 3 characters',
            ]);
        }

        // Check if BIOS is blacklisted in the current tenant
        $user = Auth::user();
        $tenantId = $user?->tenant_id;

        if ($tenantId && BiosBlacklist::blocksBios($biosId, $tenantId)) {
            return response()->json([
                'available' => false,
                'linked_username' => null,
                'is_blacklisted' => true,
                'message' => 'This BIOS ID is blacklisted',
            ]);
        }

        // Check if BIOS is active in ANY license across ALL tenants
        $existingLicense = License::whereRaw('LOWER(bios_id) = ?', [$biosId])
            ->whereIn('status', ['active', 'pending', 'suspended'])
            ->first();

        if ($existingLicense) {
            $isOwnReseller = $user && $existingLicense->reseller_id === $user->id;
            if ($existingLicense->status === 'active' || $existingLicense->status === 'suspended') {
                return response()->json([
                    'available' => false,
                    'linked_username' => null,
                    'is_blacklisted' => false,
                    'message' => 'BIOS ID is already active with another reseller',
                ]);
            }
            // pending license — only block if it belongs to a different reseller
            if (! $isOwnReseller) {
                return response()->json([
                    'available' => false,
                    'linked_username' => null,
                    'is_blacklisted' => false,
                    'message' => 'BIOS ID has a pending license with another reseller',
                ]);
            }
        }

        // BIOS not active — check if it has a linked username from history
        $link = BiosUsernameLink::where('bios_id', $biosId)->first();

        return response()->json([
            'available' => true,
            'linked_username' => $link?->username,
            'is_blacklisted' => false,
            'message' => 'Available',
        ]);
    }

    /**
     * Check username availability across all tenants
     */
    public function checkUsername(Request $request): JsonResponse
    {
        $username = strtolower(trim($request->query('username', '')));

        if (strlen($username) < 2) {
            return response()->json([
                'available' => false,
                'message' => 'Username must be at least 2 characters',
            ]);
        }

        // Check if username is active in ANY customer's license across ALL tenants
        $activeLicense = License::join('users', 'licenses.customer_id', '=', 'users.id')
            ->whereRaw('LOWER(users.username) = ?', [$username])
            ->whereIn('licenses.status', ['active', 'pending', 'suspended'])
            ->exists();

        return response()->json([
            'available' => !$activeLicense,
            'message' => $activeLicense
                ? 'Username is already active with another customer'
                : 'Available',
        ]);
    }
}
