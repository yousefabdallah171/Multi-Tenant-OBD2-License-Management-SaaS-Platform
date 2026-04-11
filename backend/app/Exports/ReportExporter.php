<?php

namespace App\Exports;

use Barryvdh\DomPDF\Facade\Pdf;
use PhpOffice\PhpSpreadsheet\Cell\Coordinate;
use PhpOffice\PhpSpreadsheet\Spreadsheet;
use PhpOffice\PhpSpreadsheet\Style\Alignment;
use PhpOffice\PhpSpreadsheet\Style\Fill;
use PhpOffice\PhpSpreadsheet\Writer\Xlsx;
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
     * @param array<int, array{title?: string|null, headers: array<int, string>, rows: array<int, array<int, string|int|float|null>>}> $sections
     * @param array<string, string|int|float> $summary
     */
    public function xlsxBinary(
        array $sections,
        ?string $title = null,
        array $summary = [],
        ?string $dateRange = null,
        string $lang = 'en',
    ): string {
        $spreadsheet = new Spreadsheet();
        $overview = $spreadsheet->getActiveSheet();
        $overview->setTitle($this->normalizeSheetTitle($lang === 'ar' ? 'ملخص' : 'Overview', 0));
        $this->writeOverviewSheet($overview, $title, $summary, $dateRange, $lang);

        $sheetIndex = 1;
        foreach ($sections as $section) {
            $sheet = $spreadsheet->createSheet($sheetIndex);
            $sheet->setTitle($this->normalizeSheetTitle((string) ($section['title'] ?? ''), $sheetIndex));
            $this->writeSectionSheet($sheet, $section);
            $sheetIndex += 1;
        }

        $writer = new Xlsx($spreadsheet);
        $writer->setPreCalculateFormulas(false);

        ob_start();
        $writer->save('php://output');
        $binary = ob_get_clean();

        return is_string($binary) ? $binary : '';
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

    private function normalizeSheetTitle(string $title, int $index): string
    {
        $clean = preg_replace('/[\\[\\]\\*\\?\\:\\/\\\\]/', '', trim($title)) ?: '';
        if ($clean === '') {
            $clean = 'Sheet '.($index + 1);
        }

        return mb_substr($clean, 0, 31);
    }

    /**
     * @param array<string, string|int|float> $summary
     */
    private function writeOverviewSheet($sheet, ?string $title, array $summary, ?string $dateRange, string $lang): void
    {
        $row = 1;
        $labelCol = 1;
        $valueCol = 2;

        $titleLabel = $lang === 'ar' ? 'عنوان التقرير' : 'Report Title';
        $rangeLabel = $lang === 'ar' ? 'النطاق الزمني' : 'Date Range';
        $generatedLabel = $lang === 'ar' ? 'تاريخ التصدير' : 'Generated At';

        if ($title) {
            $sheet->setCellValueByColumnAndRow($labelCol, $row, $titleLabel);
            $sheet->setCellValueByColumnAndRow($valueCol, $row, $title);
            $row += 1;
        }

        if ($dateRange) {
            $sheet->setCellValueByColumnAndRow($labelCol, $row, $rangeLabel);
            $sheet->setCellValueByColumnAndRow($valueCol, $row, $dateRange);
            $row += 1;
        }

        $sheet->setCellValueByColumnAndRow($labelCol, $row, $generatedLabel);
        $sheet->setCellValueByColumnAndRow($valueCol, $row, now()->toDateTimeString());
        $row += 2;

        if (! empty($summary)) {
            $sheet->setCellValueByColumnAndRow($labelCol, $row, $lang === 'ar' ? 'الملخص' : 'Summary');
            $sheet->mergeCellsByColumnAndRow($labelCol, $row, $valueCol, $row);
            $sheet->getStyleByColumnAndRow($labelCol, $row, $valueCol, $row)->applyFromArray($this->sectionTitleStyle());
            $row += 1;

            foreach ($summary as $label => $value) {
                $sheet->setCellValueByColumnAndRow($labelCol, $row, (string) $label);
                $sheet->setCellValueByColumnAndRow($valueCol, $row, (string) $value);
                $row += 1;
            }
        }

        $sheet->getStyleByColumnAndRow($labelCol, 1, $labelCol, max(1, $row))->getFont()->setBold(true);
        $sheet->getColumnDimensionByColumn($labelCol)->setAutoSize(true);
        $sheet->getColumnDimensionByColumn($valueCol)->setAutoSize(true);
    }

    /**
     * @param array{title?: string|null, headers: array<int, string>, rows: array<int, array<int, string|int|float|null>>} $section
     */
    private function writeSectionSheet($sheet, array $section): void
    {
        $row = 1;
        $headers = $section['headers'] ?? [];
        $rows = $section['rows'] ?? [];

        if (! empty($section['title'])) {
            $sheet->setCellValueByColumnAndRow(1, $row, (string) $section['title']);
            $sheet->mergeCellsByColumnAndRow(1, $row, max(1, count($headers)), $row);
            $sheet->getStyleByColumnAndRow(1, $row, max(1, count($headers)), $row)->applyFromArray($this->sectionTitleStyle());
            $row += 1;
        }

        if (! empty($headers)) {
            foreach ($headers as $index => $header) {
                $sheet->setCellValueByColumnAndRow($index + 1, $row, $header);
            }
            $sheet->getStyleByColumnAndRow(1, $row, count($headers), $row)->applyFromArray($this->headerStyle());
            $row += 1;
        }

        foreach ($rows as $rowData) {
            foreach ($rowData as $index => $value) {
                $sheet->setCellValueByColumnAndRow($index + 1, $row, $value ?? '');
            }
            $row += 1;
        }

        $columnCount = max(1, count($headers));
        for ($col = 1; $col <= $columnCount; $col += 1) {
            $sheet->getColumnDimensionByColumn($col)->setAutoSize(true);
        }
    }

    private function headerStyle(): array
    {
        return [
            'font' => [
                'bold' => true,
                'color' => ['rgb' => '0F172A'],
            ],
            'fill' => [
                'fillType' => Fill::FILL_SOLID,
                'startColor' => ['rgb' => 'E2E8F0'],
            ],
            'alignment' => [
                'vertical' => Alignment::VERTICAL_CENTER,
                'horizontal' => Alignment::HORIZONTAL_LEFT,
            ],
        ];
    }

    private function sectionTitleStyle(): array
    {
        return [
            'font' => [
                'bold' => true,
                'size' => 12,
                'color' => ['rgb' => 'FFFFFF'],
            ],
            'fill' => [
                'fillType' => Fill::FILL_SOLID,
                'startColor' => ['rgb' => '0F172A'],
            ],
            'alignment' => [
                'vertical' => Alignment::VERTICAL_CENTER,
                'horizontal' => Alignment::HORIZONTAL_LEFT,
            ],
        ];
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
