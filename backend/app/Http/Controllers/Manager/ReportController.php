<?php

namespace App\Http\Controllers\Manager;

use App\Exports\ReportExporter;
use App\Models\License;
use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\StreamedResponse;

class ReportController extends BaseManagerController
{
    public function revenue(Request $request): JsonResponse
    {
        $licenses = $this->filteredLicenses($request);

        return response()->json([
            'data' => $licenses
                ->groupBy(fn (License $license): string => $license->reseller?->name ?? 'Unknown')
                ->map(fn ($group, string $reseller): array => [
                    'reseller' => $reseller,
                    'revenue' => round((float) $group->sum('price'), 2),
                    'activations' => $group->count(),
                ])
                ->sortByDesc('revenue')
                ->values(),
        ]);
    }

    public function activations(Request $request): JsonResponse
    {
        $licenses = $this->filteredLicenses($request);
        $months = collect(range(11, 0))
            ->map(fn (int $offset): CarbonImmutable => CarbonImmutable::now()->startOfMonth()->subMonths($offset));
        $grouped = $licenses
            ->filter(fn (License $license): bool => $license->activated_at !== null)
            ->groupBy(fn (License $license): string => $license->activated_at->format('Y-m'));

        return response()->json([
            'data' => $months->map(function (CarbonImmutable $month) use ($grouped): array {
                $bucket = $grouped->get($month->format('Y-m'), collect());

                return [
                    'month' => $month->format('M Y'),
                    'count' => $bucket->count(),
                ];
            })->values(),
        ]);
    }

    public function topResellers(Request $request): JsonResponse
    {
        $licenses = $this->filteredLicenses($request);

        return response()->json([
            'data' => $licenses
                ->groupBy('reseller_id')
                ->map(function ($group): array {
                    $first = $group->first();

                    return [
                        'id' => $first?->reseller_id,
                        'reseller' => $first?->reseller?->name ?? 'Unknown',
                        'revenue' => round((float) $group->sum('price'), 2),
                        'activations' => $group->count(),
                        'customers' => $group->pluck('customer_id')->filter()->unique()->count(),
                    ];
                })
                ->sortByDesc('revenue')
                ->values(),
        ]);
    }

    public function exportCsv(Request $request): StreamedResponse
    {
        return app(ReportExporter::class)->toCsv('manager-team-report.csv', $this->exportSections($request));
    }

    public function exportPdf(Request $request)
    {
        return app(ReportExporter::class)->toPdf(
            'manager-team-report.pdf',
            'Manager Team Report',
            $this->exportSections($request),
            [],
            $this->dateRangeLabel($request),
            $this->reportLanguage($request),
        );
    }

    private function filteredLicenses(Request $request)
    {
        $validated = $request->validate([
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date'],
        ]);

        return License::query()
            ->with(['reseller:id,name', 'program:id,name'])
            ->whereIn('reseller_id', $this->teamResellerIds($request))
            ->when(! empty($validated['from']), fn ($query) => $query->whereDate('activated_at', '>=', $validated['from']))
            ->when(! empty($validated['to']), fn ($query) => $query->whereDate('activated_at', '<=', $validated['to']))
            ->get();
    }

    /**
     * @return array<int, array{title?: string|null, headers: array<int, string>, rows: array<int, array<int, string|int|float|null>>}>
     */
    private function exportSections(Request $request): array
    {
        $revenueRows = collect($this->revenue($request)->getData(true)['data']);
        $activationRows = collect($this->activations($request)->getData(true)['data']);
        $topRows = collect($this->topResellers($request)->getData(true)['data']);

        return [
            [
                'title' => 'Revenue by Reseller',
                'headers' => ['Reseller', 'Revenue', 'Activations'],
                'rows' => $revenueRows->map(fn (array $row): array => [$row['reseller'], $row['revenue'], $row['activations']])->all(),
            ],
            [
                'title' => 'Monthly Activations',
                'headers' => ['Month', 'Activations'],
                'rows' => $activationRows->map(fn (array $row): array => [$row['month'], $row['count']])->all(),
            ],
            [
                'title' => 'Top Resellers',
                'headers' => ['Reseller', 'Revenue', 'Activations', 'Customers'],
                'rows' => $topRows->map(fn (array $row): array => [$row['reseller'], $row['revenue'], $row['activations'], $row['customers']])->all(),
            ],
        ];
    }

    private function dateRangeLabel(Request $request): string
    {
        $from = $request->string('from')->toString();
        $to = $request->string('to')->toString();

        if ($from !== '' && $to !== '') {
            return sprintf('Date range: %s to %s', $from, $to);
        }

        if ($from !== '') {
            return sprintf('From %s', $from);
        }

        if ($to !== '') {
            return sprintf('Until %s', $to);
        }

        return 'All time';
    }

    private function reportLanguage(Request $request): string
    {
        $lang = $request->query('lang', $request->header('Accept-Language', 'en'));

        return str_starts_with((string) $lang, 'ar') ? 'ar' : 'en';
    }
}
