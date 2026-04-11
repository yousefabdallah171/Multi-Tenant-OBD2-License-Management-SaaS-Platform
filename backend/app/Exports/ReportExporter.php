<?php

namespace App\Exports;

use Barryvdh\DomPDF\Facade\Pdf;
use Symfony\Component\HttpFoundation\StreamedResponse;

class ReportExporter
{
    /**
     * @param array<int, array{title?: string|null, headers: array<int, string>, rows: array<int, array<int, string|int|float|null>>}> $sections
     * @param array<string, string|int|float> $summary
     */
    public function toCsv(
        string $filename,
        array $sections,
        ?string $title = null,
        array $summary = [],
        ?string $dateRange = null,
        string $lang = 'en',
    ): StreamedResponse
    {
        return response()->streamDownload(function () use ($sections, $title, $summary, $dateRange, $lang): void {
            echo "\xEF\xBB\xBF";

            $handle = fopen('php://output', 'wb');

            $this->writeCsvIntro($handle, $title, $summary, $dateRange, $lang);

            foreach ($sections as $index => $section) {
                if (! empty($section['title'])) {
                    fputcsv($handle, [$section['title']]);
                }

                fputcsv($handle, $section['headers']);

                foreach ($section['rows'] as $row) {
                    fputcsv($handle, $this->formatRow($row));
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
    public function csvString(
        array $sections,
        ?string $title = null,
        array $summary = [],
        ?string $dateRange = null,
        string $lang = 'en',
    ): string
    {
        $stream = fopen('php://temp', 'w+b');
        fwrite($stream, "\xEF\xBB\xBF");

        $this->writeCsvIntro($stream, $title, $summary, $dateRange, $lang);

        foreach ($sections as $index => $section) {
            if (! empty($section['title'])) {
                fputcsv($stream, [$section['title']]);
            }

            fputcsv($stream, $section['headers']);

            foreach ($section['rows'] as $row) {
                fputcsv($stream, $this->formatRow($row));
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
     * @param resource $handle
     * @param array<string, string|int|float> $summary
     */
    private function writeCsvIntro($handle, ?string $title, array $summary, ?string $dateRange, string $lang): void
    {
        $titleLabel = $lang === 'ar' ? 'عنوان التقرير' : 'Report Title';
        $rangeLabel = $lang === 'ar' ? 'النطاق الزمني' : 'Date Range';
        $generatedLabel = $lang === 'ar' ? 'تاريخ التصدير' : 'Generated At';

        if (! empty($title)) {
            fputcsv($handle, [$titleLabel, $title]);
        }

        if (! empty($dateRange)) {
            fputcsv($handle, [$rangeLabel, $dateRange]);
        }

        fputcsv($handle, [$generatedLabel, now()->toDateTimeString()]);

        if (! empty($summary)) {
            fputcsv($handle, []);
        }
    }

    /**
     * @param array<int, string|int|float|null> $row
     * @return array<int, string|int|float|null>
     */
    private function formatRow(array $row): array
    {
        return array_map(function ($value) {
            if (is_float($value)) {
                return number_format($value, 2, '.', ',');
            }

            if (is_int($value)) {
                return number_format($value, 0, '.', ',');
            }

            return $value ?? '';
        }, $row);
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
