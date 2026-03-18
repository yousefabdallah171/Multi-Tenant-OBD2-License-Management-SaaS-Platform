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

        // Check if BIOS is active or suspended in ANY license across ALL tenants
        // Pending licenses do NOT block — any reseller can create/activate a pending BIOS
        $existingActive = License::whereRaw('LOWER(bios_id) = ?', [$biosId])
            ->whereIn('status', ['active', 'suspended'])
            ->first();

        if ($existingActive) {
            return response()->json([
                'available' => false,
                'linked_username' => null,
                'is_blacklisted' => false,
                'message' => 'BIOS ID is already active with another reseller',
            ]);
        }

        // Also block if another pending BIOS change request is already targeting this BIOS ID
        $pendingChangeRequest = \App\Models\BiosChangeRequest::whereRaw('LOWER(new_bios_id) = ?', [$biosId])
            ->where('status', 'pending')
            ->first();

        if ($pendingChangeRequest) {
            return response()->json([
                'available' => false,
                'linked_username' => null,
                'is_blacklisted' => false,
                'message' => 'Another pending BIOS change request is already targeting this BIOS ID',
            ]);
        }

        // Check BIOS-username permanent link — return linked username for auto-fill
        $link = BiosUsernameLink::where('bios_id', $biosId)->first();

        // Also check if any historical license tied this BIOS to a different username
        if (! $link) {
            $historicalLicense = License::whereRaw('LOWER(bios_id) = ?', [$biosId])
                ->whereNotNull('external_username')
                ->latest('updated_at')
                ->first();
            if ($historicalLicense) {
                $link = (object) ['username' => $historicalLicense->external_username];
            }
        }

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

        // Check if username is active/suspended in ANY customer's license across ALL tenants
        // Pending licenses do NOT block — the same username may have a pending license
        // waiting to be activated (another reseller is allowed to activate it)
        $activeLicense = License::join('users', 'licenses.customer_id', '=', 'users.id')
            ->whereRaw('LOWER(users.username) = ?', [$username])
            ->whereIn('licenses.status', ['active', 'suspended'])
            ->exists();

        return response()->json([
            'available' => !$activeLicense,
            'message' => $activeLicense
                ? 'Username is already active with another customer'
                : 'Available',
        ]);
    }
}
