# PHASE 06: Reports & Analytics - TODO List

**Duration:** Day 8
**Deadline:** End of Day 8

---

## Reusable Chart Components

- [ ] Install Recharts: `npm install recharts`
- [ ] Create `src/components/charts/ChartCard.tsx`
  - shadcn Card wrapper with: title, description, date range picker, export dropdown
  - Loading skeleton state
  - Empty state: "No data available"
- [ ] Create `src/components/charts/LineChartWidget.tsx`
  - Props: data, xKey, yKey, color, height
  - Responsive container
  - Tooltip on hover (formatted values)
  - Grid lines (subtle)
  - Dark mode compatible colors
- [ ] Create `src/components/charts/BarChartWidget.tsx`
  - Props: data, xKey, yKey, color, height, horizontal?
  - Vertical and horizontal variants
  - Rounded bar corners
  - Value labels on bars (optional)
- [ ] Create `src/components/charts/AreaChartWidget.tsx`
  - Props: data, xKey, yKey, color, height
  - Gradient fill
  - Smooth curve
- [ ] Create `src/components/charts/PieChartWidget.tsx`
  - Props: data, nameKey, valueKey, colors
  - Legend with percentages
  - Center label (total)
  - Donut variant (innerRadius)
- [ ] Create `src/components/shared/DateRangePicker.tsx`
  - shadcn DatePicker with range selection
  - Preset ranges: Last 7 days, Last 30 days, Last 3 months, Last year, Custom

---

## Super Admin Charts

### Revenue Trend (Line)
- [ ] Update `src/pages/super-admin/Dashboard.tsx` to use `LineChartWidget`
- [ ] Fetch from `/api/super-admin/dashboard/revenue-trend`
- [ ] X-axis: months (Jan, Feb, ...), Y-axis: revenue ($)
- [ ] Tooltip: "January 2025: $5,000"

### Tenant Comparison (Bar)
- [ ] Update Dashboard to use `BarChartWidget`
- [ ] Fetch from `/api/super-admin/dashboard/tenant-comparison`
- [ ] X-axis: tenant names, Y-axis: revenue
- [ ] Horizontal bars for readability

### License Timeline (Area)
- [ ] Update Dashboard to use `AreaChartWidget`
- [ ] Fetch from `/api/super-admin/reports/activations`
- [ ] X-axis: dates, Y-axis: activation count
- [ ] Blue gradient fill

### Reports Page Charts
- [ ] Update `src/pages/super-admin/Reports.tsx`
- [ ] Add DateRangePicker at top
- [ ] Revenue by Tenant bar chart
- [ ] Growth trend line chart
- [ ] Top Resellers table (DataTable)
- [ ] Wire all to API with date range params

### BIOS Blacklist Trend Chart
- [ ] Update `src/pages/super-admin/BiosBlacklist.tsx`
- [ ] Fetch from `/api/super-admin/bios-blacklist/stats`
- [ ] Line chart: additions vs removals over time (monthly)

### IP Country Distribution Chart
- [ ] Update `src/pages/super-admin/Dashboard.tsx` (or dedicated IP page)
- [ ] PieChartWidget showing top countries by login count
- [ ] Fetch from `/api/super-admin/ip-analytics/countries`

### Financial Revenue Breakdown
- [ ] Update `src/pages/super-admin/FinancialReports.tsx`
- [ ] Stacked BarChart: Revenue by tenant + program
- [ ] Reseller Balances horizontal bar chart

---

## Manager Parent Charts

### Monthly Revenue (Line)
- [ ] Update `src/pages/manager-parent/Dashboard.tsx`
- [ ] Fetch from `/api/dashboard/revenue-chart`
- [ ] 12-month line chart

### Expiry Forecast (Bar)
- [ ] Add to Dashboard
- [ ] Fetch from `/api/dashboard/expiry-forecast`
- [ ] 3 bars: 30 days, 60 days, 90 days
- [ ] Color: yellow (30d), orange (60d), red (90d)

### Team Performance (Bar)
- [ ] Add to Dashboard
- [ ] Fetch from `/api/dashboard/team-performance`
- [ ] Horizontal bars: team member name -> activations count

### Reports Page Charts
- [ ] Update `src/pages/manager-parent/Reports.tsx`
- [ ] Revenue by Reseller (PieChartWidget - donut)
- [ ] Revenue by Program (BarChartWidget)
- [ ] Activation Success/Failure (PieChartWidget)
- [ ] Retention trend (LineChartWidget)
- [ ] DateRangePicker
- [ ] Summary cards above charts

### IP Country Distribution (Tenant)
- [ ] Update `src/pages/manager-parent/IpAnalytics.tsx`
- [ ] PieChartWidget showing top countries for tenant users
- [ ] Fetch from `/api/ip-analytics/countries`

### BIOS Conflict Rate (Tenant)
- [ ] Add to Manager Parent Dashboard or BIOS History page
- [ ] LineChartWidget: conflict attempts over time
- [ ] Fetch from `/api/bios-history/conflict-stats`

### Reseller Balances (Tenant)
- [ ] Update `src/pages/manager-parent/FinancialReports.tsx`
- [ ] BarChartWidget: Revenue per reseller
- [ ] Fetch from `/api/financial-reports/reseller-balances`

---

## Manager Charts

### Team Activations (Line)
- [ ] Update `src/pages/manager/Dashboard.tsx`
- [ ] Fetch from `/api/manager/dashboard/activations-chart`
- [ ] Monthly activation count across team resellers

### Team Revenue (Bar)
- [ ] Add to Manager Dashboard
- [ ] Fetch from `/api/manager/dashboard/revenue-chart`
- [ ] Revenue per reseller in team

---

## Reseller Charts

### Activations Trend (Line)
- [ ] Update `src/pages/manager-reseller/Dashboard.tsx`
- [ ] Fetch from `/api/reseller/dashboard/activations-chart`
- [ ] Monthly activation count line chart

### Revenue Trend (Line)
- [ ] Add to Dashboard
- [ ] Fetch from `/api/reseller/dashboard/revenue-chart`
- [ ] Monthly revenue line chart

### Reports Page
- [ ] Update `src/pages/manager-reseller/Reports.tsx`
- [ ] Revenue chart with period toggle (daily/weekly/monthly)
- [ ] Activation count bar chart
- [ ] Top Programs horizontal bar chart
- [ ] Summary cards: Total Revenue, Total Activations, Avg Price, Success Rate

---

## Export: CSV

### Backend
- [ ] Install nothing extra (Laravel has built-in streaming)
- [ ] Create `app/Exports/ReportExporter.php` helper:
  ```php
  public function toCsv(array $headers, Collection $data): StreamedResponse
  {
      return response()->streamDownload(function () use ($headers, $data) {
          echo "\xEF\xBB\xBF"; // UTF-8 BOM for Arabic
          $handle = fopen('php://output', 'w');
          fputcsv($handle, $headers);
          foreach ($data as $row) {
              fputcsv($handle, $row);
          }
          fclose($handle);
      }, 'report-' . now()->format('Y-m-d') . '.csv');
  }
  ```
- [ ] Add CSV export to Super Admin ReportController
- [ ] Add CSV export to Manager Parent ReportController
- [ ] Add CSV export to Reseller ReportController

### Frontend
- [ ] Create `src/utils/download.ts`:
  ```typescript
  export async function downloadFile(url: string, filename: string) {
    const response = await api.get(url, { responseType: 'blob' });
    const blob = new Blob([response.data]);
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
    URL.revokeObjectURL(link.href);
  }
  ```
- [ ] Wire "Export CSV" buttons in all report pages

---

## Export: PDF

### Backend
- [ ] Install: `composer require barryvdh/laravel-dompdf`
- [ ] Create PDF template: `resources/views/reports/template.blade.php`
  ```html
  <html dir="{{ $lang === 'ar' ? 'rtl' : 'ltr' }}">
  <head>
    <style>
      body { font-family: 'DejaVu Sans', sans-serif; }
      table { width: 100%; border-collapse: collapse; }
      th, td { border: 1px solid #ddd; padding: 8px; text-align: {{ $lang === 'ar' ? 'right' : 'left' }}; }
    </style>
  </head>
  <body>
    <h1>{{ $title }}</h1>
    <p>{{ $dateRange }}</p>
    <table>...</table>
  </body>
  </html>
  ```
- [ ] Add PDF export to all ReportControllers
- [ ] Test Arabic characters render correctly in PDF

### Frontend
- [ ] Wire "Export PDF" buttons in all report pages
- [ ] Same `downloadFile` utility

---

## Chart Dark Mode

- [ ] Define dark mode chart colors:
  ```typescript
  const chartColors = {
    light: {
      grid: '#E5E7EB',
      text: '#374151',
      primary: '#3B82F6',
      secondary: '#10B981',
    },
    dark: {
      grid: '#374151',
      text: '#D1D5DB',
      primary: '#60A5FA',
      secondary: '#34D399',
    }
  };
  ```
- [ ] Use `useTheme` hook in chart components to select color set
- [ ] Verify all charts look good in dark mode

---

## Chart RTL Support

- [ ] Recharts supports RTL natively via CSS
- [ ] Ensure Y-axis labels don't overlap in Arabic
- [ ] Number formatting: use `Intl.NumberFormat('ar-EG')` for Arabic numbers (optional)
- [ ] Month names in Arabic: "يناير", "فبراير", etc.

---

## Testing (20 Unit Tests)

### Chart Components
- [ ] Test 1: LineChartWidget renders with data
- [ ] Test 2: LineChartWidget shows loading skeleton
- [ ] Test 3: LineChartWidget shows empty state
- [ ] Test 4: BarChartWidget renders bars
- [ ] Test 5: BarChartWidget horizontal variant works
- [ ] Test 6: PieChartWidget renders slices
- [ ] Test 7: PieChartWidget shows legend
- [ ] Test 8: AreaChartWidget renders with gradient
- [ ] Test 9: ChartCard renders title and content
- [ ] Test 10: DateRangePicker opens calendar

### Export
- [ ] Test 11: CSV export triggers download
- [ ] Test 12: PDF export triggers download
- [ ] Test 13: Export buttons show loading state
- [ ] Test 14: ExportButtons component renders CSV + PDF options

### Dashboard Charts
- [ ] Test 15: Super Admin dashboard renders 4+ charts (including IP, financial)
- [ ] Test 16: Manager Parent dashboard renders 5+ charts (including IP, BIOS conflict)
- [ ] Test 17: Manager dashboard renders 2 charts (team activations, team revenue)
- [ ] Test 18: Reseller dashboard renders 2 charts
- [ ] Test 19: Charts update when date range changes

### Dark Mode
- [ ] Test 19: Chart colors change in dark mode
- [ ] Test 20: Chart grid lines visible in dark mode

---

## Verification (End of Day 8)

```bash
# Check each dashboard for charts:
1. /super-admin/dashboard -> 4+ charts visible (incl. IP, financial)
2. /super-admin/financial-reports -> Revenue breakdown + reseller balances
3. /dashboard (as manager_parent) -> 5+ charts visible (incl. IP, BIOS conflicts)
4. /manager/dashboard -> 2 charts visible (team activations, team revenue)
5. /reseller/dashboard -> 2 charts visible

# Test exports:
4. /super-admin/reports -> Export CSV -> file downloads
5. /super-admin/reports -> Export PDF -> file downloads

# Test dark mode charts:
6. Toggle dark mode -> charts adjust colors

# 20 tests passing (run from tests-frontend/)
cd tests-frontend && npm run test:unit -- --testPathPattern=charts
```

**Phase 06 complete. Proceed to PHASE-07-UIUXPolish.**
