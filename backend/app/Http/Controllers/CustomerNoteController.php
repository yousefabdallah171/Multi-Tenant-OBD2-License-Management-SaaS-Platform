<?php

namespace App\Http\Controllers;

use App\Models\CustomerNote;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class CustomerNoteController extends Controller
{
    /**
     * Get all notes for a customer (only the authenticated user's notes)
     */
    public function index(Request $request, int $customerId): JsonResponse
    {
        $tenantId = auth()->user()->tenant_id;
        $userId = auth()->id();

        // Query only needed columns for performance
        $notes = CustomerNote::query()
            ->where('tenant_id', $tenantId)
            ->where('customer_id', $customerId)
            ->where('user_id', $userId)
            ->select(['id', 'note', 'created_at', 'updated_at']) // Only fetch needed columns
            ->orderBy('created_at', 'desc')
            ->get();

        return response()->json(['data' => $notes]);
    }

    /**
     * Create a new note for a customer
     */
    public function store(Request $request, int $customerId): JsonResponse
    {
        $validated = $request->validate([
            'note' => ['required', 'string', 'max:5000'],
        ]);

        $tenantId = auth()->user()->tenant_id;

        // Verify customer exists in this tenant
        $customer = User::where('tenant_id', $tenantId)
            ->where('id', $customerId)
            ->first();

        if (!$customer) {
            return response()->json(['message' => 'Customer not found'], 404);
        }

        $note = CustomerNote::create([
            'tenant_id' => $tenantId,
            'user_id' => auth()->id(),
            'customer_id' => $customerId,
            'note' => $validated['note'],
        ]);

        return response()->json(['data' => $note], 201);
    }

    /**
     * Update a note (only the owner can update)
     */
    public function update(Request $request, int $noteId): JsonResponse
    {
        $validated = $request->validate([
            'note' => ['required', 'string', 'max:5000'],
        ]);

        $note = CustomerNote::where('id', $noteId)
            ->where('user_id', auth()->id())
            ->where('tenant_id', auth()->user()->tenant_id)
            ->first();

        if (!$note) {
            return response()->json(['message' => 'Note not found or you do not have permission to edit it'], 404);
        }

        $note->update(['note' => $validated['note']]);

        return response()->json(['data' => $note]);
    }

    /**
     * Delete a note (only the owner can delete)
     */
    public function destroy(int $noteId): JsonResponse
    {
        $note = CustomerNote::where('id', $noteId)
            ->where('user_id', auth()->id())
            ->where('tenant_id', auth()->user()->tenant_id)
            ->first();

        if (!$note) {
            return response()->json(['message' => 'Note not found or you do not have permission to delete it'], 404);
        }

        $note->delete();

        return response()->json(['message' => 'Note deleted successfully']);
    }
}
