<?php

namespace App\Jobs;

use App\Exports\ReportExporter;
use App\Models\ExportTask;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\Storage;
use Throwable;

class GenerateExportTask implements ShouldQueue
{
    use Queueable;

    public function __construct(private readonly string $exportTaskId)
    {
    }

    public function handle(ReportExporter $reportExporter): void
    {
        $task = ExportTask::query()->find($this->exportTaskId);
        if (! $task) {
            return;
        }

        $task->forceFill([
            'status' => 'processing',
            'error_message' => null,
        ])->save();

        try {
            $payload = $task->payload ?? [];
            $sections = $payload['sections'] ?? [];
            $summary = $payload['summary'] ?? [];
            $dateRange = $payload['date_range'] ?? null;
            $lang = $payload['lang'] ?? 'en';
            $title = $task->title ?? 'Report';

            $resolvedDateRange = is_string($dateRange) ? $dateRange : null;
            $resolvedLang = is_string($lang) ? $lang : 'en';

            if ($task->format === 'pdf') {
                $binary = $reportExporter->pdfBinary($title, $sections, $summary, $resolvedDateRange, $resolvedLang);
            } elseif ($task->format === 'xlsx') {
                $binary = $reportExporter->xlsxBinary($sections, $title, $summary, $resolvedDateRange, $resolvedLang);
            } else {
                $binary = $reportExporter->csvString($sections, $title, $summary, $resolvedDateRange, $resolvedLang);
            }

            $disk = 'local';
            $path = sprintf('exports/%s/%s', now()->format('Y/m/d'), $task->id.'.'.$task->format);
            Storage::disk($disk)->put($path, $binary);

            $mimeType = match ($task->format) {
                'pdf' => 'application/pdf',
                'xlsx' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                default => 'text/csv',
            };

            $task->forceFill([
                'status' => 'completed',
                'storage_disk' => $disk,
                'storage_path' => $path,
                'mime_type' => $mimeType,
                'completed_at' => now(),
            ])->save();
        } catch (Throwable $exception) {
            $task->forceFill([
                'status' => 'failed',
                'error_message' => $exception->getMessage(),
            ])->save();
        }
    }
}
