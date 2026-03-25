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

        // Always resolve the linked username for this BIOS (needed for locking even when unavailable)
        $linkedUsernameForBios = null;
        $biosLink = BiosUsernameLink::where('bios_id', $biosId)->first();
        if ($biosLink) {
            $linkedUsernameForBios = $biosLink->username;
        } else {
            $historicalLicense = License::whereRaw('LOWER(bios_id) = ?', [$biosId])
                ->whereNotNull('external_username')
                ->latest('updated_at')
                ->first();
            $linkedUsernameForBios = $historicalLicense?->external_username;
        }

        if ($tenantId && BiosBlacklist::blocksBios($biosId, $tenantId)) {
            return response()->json([
                'available' => false,
                'linked_username' => $linkedUsernameForBios,
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
                'linked_username' => $linkedUsernameForBios,
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
                'linked_username' => $linkedUsernameForBios,
                'is_blacklisted' => false,
                'message' => 'Another pending BIOS change request is already targeting this BIOS ID',
            ]);
        }

        return response()->json([
            'available' => true,
            'linked_username' => $linkedUsernameForBios,
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
                'linked_bios' => null,
                'message' => 'Username must be at least 2 characters',
            ]);
        }

        // Check if username is permanently linked to a BIOS ID via BiosUsernameLink
        $biosLink = BiosUsernameLink::whereRaw('LOWER(username) = ?', [$username])->first();
        $linkedBios = $biosLink?->bios_id;

        // If not in the permanent link table, check historical licenses for a BIOS association
        if (! $linkedBios) {
            $historicalLicense = License::join('users', 'licenses.customer_id', '=', 'users.id')
                ->whereRaw('LOWER(users.username) = ?', [$username])
                ->whereNotNull('licenses.bios_id')
                ->latest('licenses.updated_at')
                ->select('licenses.bios_id')
                ->first();
            $linkedBios = $historicalLicense?->bios_id;
        }

        // Check if username is active/suspended in ANY customer's license across ALL tenants
        $activeLicense = License::join('users', 'licenses.customer_id', '=', 'users.id')
            ->whereRaw('LOWER(users.username) = ?', [$username])
            ->whereIn('licenses.status', ['active', 'suspended'])
            ->exists();

        return response()->json([
            'available' => !$activeLicense,
            'linked_bios' => $linkedBios,
            'message' => $activeLicense
                ? 'Username is already active with another customer'
                : 'Available',
        ]);
    }
}
