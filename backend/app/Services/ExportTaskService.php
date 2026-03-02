<?php

namespace App\Services;

use App\Jobs\GenerateExportTask;
use App\Models\ExportTask;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Config;

class ExportTaskService
{
    /**
     * @param  array<int, array{title?: string|null, headers: array<int, string>, rows: array<int, array<int, string|int|float|null>>}>  $sections
     * @param  array<string, int|float>  $summary
     */
    public function queue(
        Request $request,
        string $format,
        string $filename,
        string $title,
        array $sections,
        array $summary = [],
        ?string $dateRange = null,
        string $lang = 'en',
    ): ExportTask {
        $task = ExportTask::query()->create([
            'tenant_id' => $request->user()?->tenant_id,
            'user_id' => $request->user()?->id,
            'status' => 'pending',
            'format' => $format,
            'filename' => $filename,
            'title' => $title,
            'payload' => [
                'sections' => $sections,
                'summary' => $summary,
                'date_range' => $dateRange,
                'lang' => $lang,
            ],
        ]);

        $asyncEnabled = (bool) env('EXPORT_ASYNC_ENABLED', false);
        $queueDriver = (string) Config::get('queue.default', 'sync');

        if ($asyncEnabled && $queueDriver !== 'sync') {
            GenerateExportTask::dispatch($task->id);
        } else {
            GenerateExportTask::dispatchSync($task->id);
        }

        return $task;
    }
}
