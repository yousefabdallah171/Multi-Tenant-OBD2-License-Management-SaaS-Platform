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

        return response()
            ->json(['data' => $notes])
            ->header('Cache-Control', 'private, max-age=300'); // Cache for 5 minutes on client side
    }

    /**
     * Create a new note for a customer
     */
    public function store(Request $request, int $customerId): JsonResponse
    {
        try {
            $validated = $request->validate([
                'note' => ['required', 'string', 'max:5000'],
            ]);

            $tenantId = auth()->user()->tenant_id;
            $userId = auth()->id();

            \Log::debug('Creating note', [
                'customer_id' => $customerId,
                'user_id' => $userId,
                'tenant_id' => $tenantId,
                'note_length' => strlen($validated['note']),
            ]);

            // Verify customer exists in this tenant
            $customer = User::where('tenant_id', $tenantId)
                ->where('id', $customerId)
                ->first();

            if (!$customer) {
                \Log::warning('Customer not found', [
                    'customer_id' => $customerId,
                    'tenant_id' => $tenantId,
                ]);

                return response()->json(['message' => 'Customer not found'], 404);
            }

            $note = CustomerNote::create([
                'tenant_id' => $tenantId,
                'user_id' => $userId,
                'customer_id' => $customerId,
                'note' => $validated['note'],
            ]);

            \Log::info('Note created successfully', ['note_id' => $note->id]);

            return response()->json(['data' => $note], 201);
        } catch (\Illuminate\Validation\ValidationException $e) {
            \Log::warning('Validation error on note creation', ['errors' => $e->errors()]);
            return response()->json(['message' => 'Validation failed', 'errors' => $e->errors()], 422);
        } catch (\Exception $e) {
            \Log::error('Error creating note', [
                'error' => $e->getMessage(),
                'customer_id' => $customerId,
            ]);

            return response()->json(['message' => 'Failed to create note: ' . $e->getMessage()], 500);
        }
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
    public function destroy(Request $request, int $noteId): JsonResponse
    {
        try {
            $userId = auth()->id();
            $tenantId = auth()->user()->tenant_id;

            // Log deletion attempt for debugging
            \Log::debug('Attempting to delete note', [
                'note_id' => $noteId,
                'user_id' => $userId,
                'tenant_id' => $tenantId,
            ]);

            $note = CustomerNote::where('id', $noteId)
                ->where('user_id', $userId)
                ->where('tenant_id', $tenantId)
                ->first();

            if (!$note) {
                \Log::warning('Note not found for deletion', [
                    'note_id' => $noteId,
                    'user_id' => $userId,
                    'tenant_id' => $tenantId,
                ]);

                return response()->json([
                    'message' => 'Note not found or you do not have permission to delete it'
                ], 404);
            }

            $note->delete();

            \Log::info('Note deleted successfully', ['note_id' => $noteId]);

            return response()->json(['message' => 'Note deleted successfully']);
        } catch (\Exception $e) {
            \Log::error('Error deleting note', [
                'note_id' => $noteId,
                'error' => $e->getMessage(),
            ]);

            return response()->json(['message' => 'Failed to delete note'], 500);
        }
    }
}
