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
     */
    public function csvString(array $sections): string
    {
        $stream = fopen('php://temp', 'w+b');
        fwrite($stream, "\xEF\xBB\xBF");

        foreach ($sections as $index => $section) {
            if (! empty($section['title'])) {
                fputcsv($stream, [$section['title']]);
            }

            fputcsv($stream, $section['headers']);

            foreach ($section['rows'] as $row) {
                fputcsv($stream, $row);
            }

            if ($index < count($sections) - 1) {
                fputcsv($stream, []);
            }
        }

        rewind($stream);
        $content = stream_get_contents($stream);
        fclose($stream);

        return $content ?: '';
    }

    /**
     * @param array<int, array{title?: string|null, headers: array<int, string>, rows: array<int, array<int, string|int|float|null>>}> $sections
     * @param array<string, string|int|float> $summary
     */
    public function toPdf(string $filename, string $title, array $sections, array $summary = [], ?string $dateRange = null, string $lang = 'en')
    {
        $pdf = Pdf::loadHTML($this->pdfHtml($title, $sections, $summary, $dateRange, $lang));

        return $pdf->download($filename);
    }

    /**
     * @param array<int, array{title?: string|null, headers: array<int, string>, rows: array<int, array<int, string|int|float|null>>}> $sections
     * @param array<string, string|int|float> $summary
     */
    public function pdfBinary(string $title, array $sections, array $summary = [], ?string $dateRange = null, string $lang = 'en'): string
    {
        return Pdf::loadHTML($this->pdfHtml($title, $sections, $summary, $dateRange, $lang))->output();
    }

    /**
     * @param array<int, array{title?: string|null, headers: array<int, string>, rows: array<int, array<int, string|int|float|null>>}> $sections
     * @param array<string, string|int|float> $summary
     */
    private function pdfHtml(string $title, array $sections, array $summary = [], ?string $dateRange = null, string $lang = 'en'): string
    {
        return view('reports.template', [
            'title' => $title,
            'sections' => $sections,
            'summary' => $summary,
            'dateRange' => $dateRange,
            'lang' => $lang,
            'generatedAt' => now(),
        ])->render();
    }
}
