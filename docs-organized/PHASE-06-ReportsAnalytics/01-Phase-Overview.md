# PHASE 06: Reports & Analytics

**Duration:** Day 8
**Status:** Pending
**Tests Target:** 20 unit tests
**Depends On:** Phases 01-05 (All dashboards built)

---

## Goals

- Implement all dashboard charts across all roles using Recharts
- Build export functionality (CSV, PDF)
- Create reusable chart components
- Ensure all reports are role-scoped and tenant-scoped
- Wire charts to real API data

---

## Charts Summary (18 Total)

### Super Admin Charts (7)

| Chart | Type | Data |
|-------|------|------|
| Revenue Trend | Line | Monthly revenue across all tenants (12 months) |
| Tenant Comparison | Bar | Top 10 tenants by revenue |
| License Timeline | Area | Daily activations (last 30 days) |
| IP Country Distribution | Pie | User logins by country (global) |
| BIOS Blacklist Trend | Line | Blacklist additions/removals over time |
| Financial Revenue Breakdown | Stacked Bar | Revenue by tenant + program |
| Reseller Balances | Bar | Top resellers by revenue across tenants |

### Manager Parent Charts (7)

| Chart | Type | Data |
|-------|------|------|
| Monthly Revenue | Line | Tenant monthly revenue (12 months) |
| Expiry Forecast | Bar | Licenses expiring in 30/60/90 days |
| Team Performance | Bar | Activations per team member |
| Revenue by Reseller | Pie | Revenue distribution among resellers |
| IP Country Distribution | Pie | Tenant user logins by country |
| BIOS Conflict Rate | Line | Conflict attempts over time |
| Reseller Balances | Bar | Revenue per reseller in tenant |

### Manager Charts (2)

| Chart | Type | Data |
|-------|------|------|
| Team Activations | Line | Monthly activations by team resellers |
| Team Revenue | Bar | Revenue per reseller in team |

### Reseller Charts (2)

| Chart | Type | Data |
|-------|------|------|
| Activations Trend | Line | Monthly activation count |
| Revenue Trend | Line | Monthly revenue |

---

## Reusable Chart Components

```
frontend/src/components/charts/
├── BaseChart.tsx                # Shared wrapper (responsive container, loading, empty state)
├── LineChartWidget.tsx          # Reusable line chart
├── BarChartWidget.tsx           # Reusable bar chart
├── AreaChartWidget.tsx          # Reusable area chart
├── PieChartWidget.tsx           # Reusable pie/donut chart
└── ChartCard.tsx                # Card wrapper with title, date range, export button
```

### BaseChart Pattern

```tsx
interface BaseChartProps {
  title: string;
  data: any[];
  isLoading: boolean;
  height?: number;
  dateRange?: { from: Date; to: Date };
  onExport?: (format: 'csv' | 'pdf') => void;
}
```

---

## Export Functionality

### CSV Export

- Backend generates CSV using Laravel's streaming response
- Frontend triggers download via blob URL
- Includes headers matching table columns
- UTF-8 BOM for Arabic character support

### PDF Export

- Backend uses `barryvdh/laravel-dompdf` package
- Report template with:
  - Header: OBD2SW logo, report title, date range
  - Summary stats section
  - Data table
  - Footer: generated date, page numbers
- RTL support for Arabic PDFs

### Export API Pattern

```php
// CSV
Route::get('/reports/export/csv', function (Request $request) {
    return response()->streamDownload(function () use ($request) {
        echo "\xEF\xBB\xBF"; // UTF-8 BOM for Arabic
        // ... CSV rows
    }, 'report.csv', ['Content-Type' => 'text/csv']);
});

// PDF
Route::get('/reports/export/pdf', function (Request $request) {
    $pdf = PDF::loadView('reports.template', $data);
    return $pdf->download('report.pdf');
});
```

---

## Backend Report Endpoints

### Super Admin Reports

```php
GET /api/super-admin/reports/revenue?from=&to=
    → { months: [{ month: "2025-01", revenue: 5000 }, ...] }

GET /api/super-admin/reports/activations?from=&to=
    → { days: [{ date: "2025-01-15", count: 12 }, ...] }

GET /api/super-admin/reports/tenant-comparison
    → { tenants: [{ name: "Tenant A", revenue: 3000, licenses: 50 }, ...] }

GET /api/super-admin/reports/growth
    → { months: [{ month: "2025-01", new_users: 25 }, ...] }

GET /api/super-admin/reports/top-resellers?limit=20
    → { resellers: [{ name: "Ahmed", revenue: 2000, activations: 30 }, ...] }
```

### Manager Parent Reports

```php
GET /api/reports/revenue-by-reseller?from=&to=
    → { resellers: [{ name: "Ali", revenue: 1500, percentage: 35 }, ...] }

GET /api/reports/revenue-by-program?from=&to=
    → { programs: [{ name: "HaynesPro", revenue: 2000, count: 20 }, ...] }

GET /api/reports/activation-rate
    → { total: 100, success: 92, failure: 8, rate: 92.0 }

GET /api/reports/retention?from=&to=
    → { months: [{ month: "2025-01", active: 80, churned: 5, rate: 94.1 }, ...] }
```

### Reseller Reports

```php
GET /api/reseller/reports/revenue?period=monthly
    → { data: [{ period: "2025-01", revenue: 500 }, ...] }

GET /api/reseller/reports/activations?period=monthly
    → { data: [{ period: "2025-01", count: 15 }, ...] }

GET /api/reseller/reports/top-programs
    → { programs: [{ name: "HaynesPro", count: 10, revenue: 1000 }, ...] }
```

---

## Acceptance Criteria

- [ ] All 18 charts render correctly with real data
- [ ] Charts are responsive (resize with container)
- [ ] Charts support dark mode (colors adjust)
- [ ] RTL: chart labels render correctly in Arabic
- [ ] Date range picker filters chart data
- [ ] CSV export downloads file with correct data (Arabic characters preserved)
- [ ] PDF export downloads formatted report
- [ ] Loading skeletons shown while chart data fetches
- [ ] Empty state shown when no data
- [ ] Charts use consistent color palette across app
- [ ] 20 unit tests passing
