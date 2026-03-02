<?php

namespace App\Http\Controllers;

use App\Models\ExportTask;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\StreamedResponse;

class ExportTaskController extends Controller
{
    public function show(Request $request, ExportTask $exportTask): JsonResponse
    {
        abort_unless((int) $exportTask->user_id === (int) $request->user()?->id, 403);

        return response()->json([
            'data' => [
                'id' => $exportTask->id,
                'status' => $exportTask->status,
                'filename' => $exportTask->filename,
                'format' => $exportTask->format,
                'error' => $exportTask->error_message,
                'download_url' => $exportTask->status === 'completed' ? '/api/exports/'.$exportTask->id.'/download' : null,
                'completed_at' => $exportTask->completed_at?->toIso8601String(),
            ],
        ]);
    }

    public function download(Request $request, ExportTask $exportTask): StreamedResponse
    {
        abort_unless((int) $exportTask->user_id === (int) $request->user()?->id, 403);
        abort_unless($exportTask->status === 'completed' && filled($exportTask->storage_disk) && filled($exportTask->storage_path), 404);

        return Storage::disk((string) $exportTask->storage_disk)->download(
            (string) $exportTask->storage_path,
            (string) $exportTask->filename,
            ['Content-Type' => $exportTask->mime_type ?? 'application/octet-stream'],
        );
    }
}
