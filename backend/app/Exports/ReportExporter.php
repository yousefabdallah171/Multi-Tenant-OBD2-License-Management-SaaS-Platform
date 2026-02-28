<?php

namespace App\Exports;

use Barryvdh\DomPDF\Facade\Pdf;
use Symfony\Component\HttpFoundation\StreamedResponse;

class ReportExporter
{
    /**
     * @param array<int, array{title?: string|null, headers: array<int, string>, rows: array<int, array<int, string|int|float|null>>}> $sections
     */
    public function toCsv(string $filename, array $sections): StreamedResponse
    {
        return response()->streamDownload(function () use ($sections): void {
            echo "\xEF\xBB\xBF";

            $handle = fopen('php://output', 'wb');

            foreach ($sections as $index => $section) {
                if (! empty($section['title'])) {
                    fputcsv($handle, [$section['title']]);
                }

                fputcsv($handle, $section['headers']);

                foreach ($section['rows'] as $row) {
                    fputcsv($handle, $row);
                }

                if ($index < count($sections) - 1) {
                    fputcsv($handle, []);
                }
            }

            fclose($handle);
        }, $filename, ['Content-Type' => 'text/csv; charset=UTF-8']);
    }

    /**
     * @param array<int, array{title?: string|null, headers: array<int, string>, rows: array<int, array<int, string|int|float|null>>}> $sections
     * @param array<string, string|int|float> $summary
     */
    public function toPdf(string $filename, string $title, array $sections, array $summary = [], ?string $dateRange = null, string $lang = 'en')
    {
        $pdf = Pdf::loadView('reports.template', [
            'title' => $title,
            'sections' => $sections,
            'summary' => $summary,
            'dateRange' => $dateRange,
            'lang' => $lang,
            'generatedAt' => now(),
        ]);

        return $pdf->download($filename);
    }
}
