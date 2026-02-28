<?php

namespace App\Http\Controllers\SuperAdmin;

use App\Models\License;
use App\Models\User;
use Barryvdh\DomPDF\Facade\Pdf;
use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\StreamedResponse;

class ReportController extends BaseSuperAdminController
{
    public function revenue(Request $request): JsonResponse
    {
        $licenses = $this->filteredLicenses($request);

        $data = $licenses
            ->groupBy(fn (License $license): string => $license->tenant?->name ?? 'Unknown')
            ->map(fn ($group, string $tenant): array => [
                'tenant' => $tenant,
                'revenue' => round((float) $group->sum('price'), 2),
            ])
            ->sortByDesc('revenue')
            ->values();

        return response()->json(['data' => $data]);
    }

    public function activations(Request $request): JsonResponse
    {
        $licenses = $this->filteredLicenses($request);

        $data = $licenses
            ->groupBy(fn (License $license): string => $license->tenant?->name ?? 'Unknown')
            ->map(fn ($group, string $tenant): array => [
                'tenant' => $tenant,
                'activations' => $group->count(),
                'active' => $group->where('status', 'active')->count(),
                'pending' => $group->where('status', 'pending')->count(),
            ])
            ->sortByDesc('activations')
            ->values();

        return response()->json(['data' => $data]);
    }

    public function growth(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date'],
        ]);

        $start = ! empty($validated['from']) ? CarbonImmutable::parse($validated['from'])->startOfMonth() : CarbonImmutable::now()->startOfMonth()->subMonths(11);
        $end = ! empty($validated['to']) ? CarbonImmutable::parse($validated['to'])->endOfMonth() : CarbonImmutable::now()->endOfMonth();

        $months = collect();
        $cursor = $start;

        while ($cursor <= $end) {
            $months->push($cursor);
            $cursor = $cursor->addMonth();
        }

        $users = User::query()
            ->whereBetween('created_at', [$start, $end])
            ->get()
            ->groupBy(fn (User $user): string => $user->created_at?->format('Y-m') ?? '');

        return response()->json([
            'data' => $months->map(fn (CarbonImmutable $month): array => [
                'month' => $month->format('M Y'),
                'users' => $users->get($month->format('Y-m'))?->count() ?? 0,
            ])->values(),
        ]);
    }

    public function topResellers(Request $request): JsonResponse
    {
        $licenses = $this->filteredLicenses($request);

        $data = $licenses
            ->groupBy(fn (License $license): string => $license->reseller?->name ?? 'Unknown')
            ->map(fn ($group, string $reseller): array => [
                'reseller' => $reseller,
                'tenant' => $group->first()?->tenant?->name,
                'activations' => $group->count(),
                'revenue' => round((float) $group->sum('price'), 2),
            ])
            ->sortByDesc('revenue')
            ->take(20)
            ->values();

        return response()->json(['data' => $data]);
    }

    public function exportCsv(Request $request): StreamedResponse
    {
        $rows = $this->revenue($request)->getData(true)['data'];

        return response()->streamDownload(function () use ($rows): void {
            $handle = fopen('php://output', 'wb');
            fputcsv($handle, ['Tenant', 'Revenue']);

            foreach ($rows as $row) {
                fputcsv($handle, [$row['tenant'], $row['revenue']]);
            }

            fclose($handle);
        }, 'super-admin-revenue-report.csv', ['Content-Type' => 'text/csv']);
    }

    public function exportPdf(Request $request)
    {
        $rows = $this->revenue($request)->getData(true)['data'];

        $pdf = Pdf::loadHTML(view('pdf.simple-table', [
            'title' => 'Super Admin Revenue Report',
            'columns' => ['Tenant', 'Revenue'],
            'rows' => collect($rows)->map(fn (array $row): array => [$row['tenant'], $row['revenue']])->all(),
        ])->render());

        return $pdf->download('super-admin-revenue-report.pdf');
    }

    private function filteredLicenses(Request $request)
    {
        $validated = $request->validate([
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date'],
        ]);

        return License::query()
            ->with(['tenant:id,name', 'reseller:id,name'])
            ->when(! empty($validated['from']), fn ($query) => $query->whereDate('activated_at', '>=', $validated['from']))
            ->when(! empty($validated['to']), fn ($query) => $query->whereDate('activated_at', '<=', $validated['to']))
            ->get();
    }
}
