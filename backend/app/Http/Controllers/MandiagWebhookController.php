<?php

namespace App\Http\Controllers;

use App\Jobs\ProcessMandiagWebhookEvent;
use App\Models\MandiagWebhookEvent;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class MandiagWebhookController extends Controller
{
    public function receive(Request $request): JsonResponse
    {
        $rawBody = $request->getContent();
        $ts      = $request->header('X-Mandiag-Timestamp', '');
        $sig     = $request->header('X-Mandiag-Signature', '');
        $secret  = (string) config('mandiag.webhook_secret');

        // 1. Timestamp check — reject stale deliveries (±300 seconds)
        if (! ctype_digit((string) $ts) || abs(time() - (int) $ts) > 300) {
            return response()->json(['error' => 'stale'], 400);
        }

        // 2. Signature check — constant-time compare
        $expected = hash_hmac('sha256', $ts . '.' . $rawBody, $secret);
        if (! hash_equals($expected, $sig)) {
            return response()->json(['error' => 'invalid signature'], 401);
        }

        $payload = json_decode($rawBody, true);
        $eventId = $payload['event_id'] ?? null;

        // 3. Guard: event_id must be a non-empty string
        if (! is_string($eventId) || $eventId === '') {
            return response()->json(['error' => 'missing event_id'], 400);
        }

        // 4. TOCTOU-safe dedup — let the DB unique constraint be the authority
        try {
            MandiagWebhookEvent::create([
                'event_id'    => $eventId,
                'event_type'  => $payload['event'] ?? 'unknown',
                'payload'     => $payload,
                'occurred_at' => $payload['occurred_at'] ?? null,
            ]);
        } catch (\Illuminate\Database\UniqueConstraintViolationException) {
            return response()->json(['status' => 'duplicate'], 200);
        }

        // 5. Dispatch async job — return 200 immediately, stay within Mandiag's 15s timeout
        ProcessMandiagWebhookEvent::dispatch($payload['event'] ?? '', $payload['data'] ?? []);

        return response()->json(['status' => 'ok'], 200);
    }
}
