import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Banknote, ShieldCheck, Users } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { BarChartWidget } from '@/components/charts/BarChartWidget'
import { LineChartWidget } from '@/components/charts/LineChartWidget'
import { PageHeader } from '@/components/manager-parent/PageHeader'
import { DataTable, type DataTableColumn } from '@/components/shared/DataTable'
import { ExportButtons } from '@/components/shared/ExportButtons'
import { RoleIdentity } from '@/components/shared/RoleIdentity'
import { StatsCard } from '@/components/shared/StatsCard'
import { Card, CardContent } from '@/components/ui/card'
import { DateRangePicker, type DateRangeValue } from '@/components/ui/date-range-picker'
import { useLanguage, type SupportedLanguage } from '@/hooks/useLanguage'
import { localizeMonthLabel } from '@/lib/chart-labels'
import { formatCurrency } from '@/lib/utils'
import { routePaths } from '@/router/routes'
import { managerParentService } from '@/services/manager-parent.service'
import type { FinancialReportData, SellerScopeParams } from '@/types/manager-parent.types'
import type { UserRole } from '@/types/user.types'

export function FinancialReportsPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { lang } = useLanguage()
  const locale = lang === 'ar' ? 'ar-EG' : 'en-US'
  const [searchParams, setSearchParams] = useSearchParams()
  const [range, setRange] = useState<DateRangeValue>(() => ({
    from: searchParams.get('from') || resolvePresetRange(365).from,
    to: searchParams.get('to') || resolvePresetRange(365).to,
  }))

  const scope = useMemo<SellerScopeParams>(() => ({
    manager_parent_id: parseNumericSearchParam(searchParams.get('manager_parent_id')),
    manager_id: parseNumericSearchParam(searchParams.get('manager_id')),
    reseller_id: parseNumericSearchParam(searchParams.get('reseller_id')),
    scope_name: searchParams.get('scope_name') || undefined,
    scope_role: normalizeScopeRole(searchParams.get('scope_role')),
  }), [searchParams])

  const reportParams = useMemo(
    () => ({
      from: range.from,
      to: range.to,
      manager_parent_id: scope.manager_parent_id || undefined,
      manager_id: scope.manager_id || undefined,
      reseller_id: scope.reseller_id || undefined,
    }),
    [range.from, range.to, scope.manager_id, scope.manager_parent_id, scope.reseller_id],
  )

  useEffect(() => {
    const next = new URLSearchParams()

    if (range.from) next.set('from', range.from)
    if (range.to) next.set('to', range.to)
    if (scope.manager_parent_id) next.set('manager_parent_id', String(scope.manager_parent_id))
    if (scope.manager_id) next.set('manager_id', String(scope.manager_id))
    if (scope.reseller_id) next.set('reseller_id', String(scope.reseller_id))
    if (scope.scope_name) next.set('scope_name', scope.scope_name)
    if (scope.scope_role) next.set('scope_role', scope.scope_role)

    setSearchParams(next, { replace: true })
  }, [range.from, range.to, scope.manager_id, scope.manager_parent_id, scope.reseller_id, scope.scope_name, scope.scope_role, setSearchParams])

  const reportQuery = useQuery({
    queryKey: ['manager-parent', 'financial-reports', reportParams],
    queryFn: () => managerParentService.getFinancialReports(reportParams),
  })
  const retentionQuery = useQuery({
    queryKey: ['manager-parent', 'reports', 'retention', reportParams],
    queryFn: () => managerParentService.getRetention(reportParams),
  })

  const report = reportQuery.data?.data
  const monthlyRevenueSeries = (report?.monthly_revenue ?? []).map((item) => ({
    ...item,
    month: item.month ? localizeMonthLabel(item.month, locale) : item.month,
  }))
  const retentionSeries = (retentionQuery.data?.data ?? []).map((item) => ({
    ...item,
    month: item.month ? localizeMonthLabel(item.month, locale) : item.month,
  }))
  const columns = useMemo<Array<DataTableColumn<FinancialReportData['reseller_balances'][number]>>>(
    () => [
      {
        key: 'reseller',
        label: t('managerParent.pages.financialReports.columns.seller'),
        sortable: true,
        sortValue: (row) => row.reseller,
        render: (row) => (
          <RoleIdentity
            name={row.reseller}
            role={resolveUserRole(row.role)}
            href={getManagerParentSellerDetailPath(lang, row.id, row.role)}
          />
        ),
      },
      { key: 'revenue', label: t('managerParent.pages.financialReports.columns.totalRevenue'), sortable: true, sortValue: (row) => row.total_revenue, render: (row) => formatCurrency(row.total_revenue, 'USD', locale) },
      { key: 'activations', label: t('common.activations'), sortable: true, sortValue: (row) => row.total_activations, render: (row) => row.total_activations },
      { key: 'avgPrice', label: t('managerParent.pages.financialReports.columns.avgPrice'), sortable: true, sortValue: (row) => row.avg_price, render: (row) => formatCurrency(row.avg_price, 'USD', locale) },
      { key: 'stillNotPaid', label: t('managerParent.pages.financialReports.columns.stillNotPaid'), sortable: true, sortValue: (row) => row.still_not_paid, render: (row) => formatCurrency(row.still_not_paid, 'USD', locale) },
    ],
    [lang, locale, t],
  )

  const scopeHint = getScopeHint(t, scope)
  const customersHref = buildScopedCustomersPath(routePaths.managerParent.customers(lang), scope)
  const activeCustomersHref = buildScopedCustomersPath(routePaths.managerParent.customers(lang), scope, { status: 'active' })

  const sellerLabel = (seller?: { reseller?: string; email?: string | null }) => {
    if (!seller) return ''
    if (seller.email) {
      return `${seller.reseller} • ${seller.email}`
    }
    return seller.reseller ?? ''
  }

  const handleSellerClick = (seller?: { id?: number; role?: string | null }) => {
    if (!seller?.id) return
    const href = getManagerParentSellerDetailPath(lang, seller.id, seller.role)
    if (href) {
      navigate(href)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('managerParent.pages.financialReports.title')}
        description={t('managerParent.pages.financialReports.description')}
        actions={<ExportButtons onExportCsv={() => managerParentService.exportFinancialCsv(reportParams)} onExportPdf={() => managerParentService.exportFinancialPdf(reportParams)} />}
      />

      <Card>
        <CardContent className="space-y-3 p-4">
          <DateRangePicker value={range} onChange={setRange} />
          {scopeHint ? (
            <div className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900 dark:border-sky-900/60 dark:bg-sky-950/30 dark:text-sky-100">
              {scopeHint}
            </div>
          ) : null}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        <StatsCard title={t('managerParent.pages.financialReports.totalTenantRevenue')} value={formatCurrency(report?.summary.total_revenue ?? 0, 'USD', locale)} icon={Banknote} color="emerald" />
        <button type="button" className="w-full text-start" onClick={() => navigate(customersHref)}>
          <StatsCard title={t('managerParent.pages.financialReports.totalCustomers')} value={report?.summary.total_customers ?? 0} icon={Users} color="sky" />
        </button>
        <button type="button" className="w-full text-start" onClick={() => navigate(activeCustomersHref)}>
          <StatsCard title={t('managerParent.pages.financialReports.activeCustomers')} value={report?.summary.active_customers ?? report?.summary.active_licenses ?? 0} icon={ShieldCheck} color="amber" />
        </button>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <BarChartWidget
          title={t('managerParent.pages.financialReports.revenueByReseller')}
          data={report?.revenue_by_reseller ?? []}
          isLoading={reportQuery.isLoading}
          xKey="reseller"
          horizontal
          showLabels
          series={[{ key: 'revenue', label: t('common.revenue') }]}
          valueFormatter={(value) => formatCurrency(Number(value), 'USD', locale)}
          tooltipLabelFormatter={(value, payload) => sellerLabel(payload)}
          onEntryClick={(payload) => handleSellerClick(payload)}
        />
        <BarChartWidget
          title={t('managerParent.pages.financialReports.revenueByProgram')}
          data={report?.revenue_by_program ?? []}
          isLoading={reportQuery.isLoading}
          xKey="program"
          series={[{ key: 'revenue', label: t('common.revenue') }]}
          valueFormatter={(value) => formatCurrency(Number(value), 'USD', locale)}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <LineChartWidget
          title={t('managerParent.pages.financialReports.monthlyRevenueTrend')}
          data={monthlyRevenueSeries}
          isLoading={reportQuery.isLoading}
          xKey="month"
          series={[{ key: 'revenue', label: t('common.revenue') }]}
          valueFormatter={(value) => formatCurrency(Number(value), 'USD', locale)}
        />
        <BarChartWidget
          title={t('managerParent.pages.financialReports.stillNotPaidBySeller')}
          description={t('managerParent.pages.financialReports.stillNotPaidHint')}
          data={report?.reseller_balances ?? []}
          isLoading={reportQuery.isLoading}
          xKey="reseller"
          horizontal
          showLabels
          series={[{ key: 'still_not_paid', label: t('managerParent.pages.financialReports.columns.stillNotPaid') }]}
          valueFormatter={(value) => formatCurrency(Number(value), 'USD', locale)}
          tooltipLabelFormatter={(value, payload) => sellerLabel(payload as { reseller?: string; email?: string | null })}
          onEntryClick={(payload) => handleSellerClick(payload as { id?: number; role?: string | null })}
        />
      </div>

      <LineChartWidget
        title={t('managerParent.pages.reports.customerRetention')}
        data={retentionSeries}
        isLoading={retentionQuery.isLoading}
        xKey="month"
        series={[{ key: 'customers', label: t('managerParent.pages.reports.customersLabel') }]}
      />

      <Card>
        <CardContent className="p-6">
          <h3 className="mb-2 text-lg font-semibold">{t('managerParent.pages.financialReports.stillNotPaidBySeller')}</h3>
          <p className="mb-4 text-sm text-slate-500 dark:text-slate-400">{t('managerParent.pages.financialReports.stillNotPaidHint')}</p>
          <DataTable tableKey="manager_parent_financial_reports_balances" columns={columns} data={report?.reseller_balances ?? []} rowKey={(row) => row.id} isLoading={reportQuery.isLoading} />
        </CardContent>
      </Card>
    </div>
  )
}

function resolveUserRole(role?: string | null): UserRole | null {
  if (role === 'super_admin' || role === 'manager_parent' || role === 'manager' || role === 'reseller' || role === 'customer') {
    return role
  }

  return null
}

function getManagerParentSellerDetailPath(lang: SupportedLanguage, id: number, role?: string | null) {
  if (!id) {
    return undefined
  }

  if (role === 'manager_parent' || role === 'manager' || role === 'reseller') {
    return routePaths.managerParent.teamMemberDetail(lang, id)
  }

  return undefined
}

function resolvePresetRange(days: number): DateRangeValue {
  const today = new Date()
  const from = new Date(today)
  from.setDate(today.getDate() - (days - 1))

  return {
    from: formatDateInput(from),
    to: formatDateInput(today),
  }
}

function formatDateInput(value: Date) {
  const year = value.getFullYear()
  const month = String(value.getMonth() + 1).padStart(2, '0')
  const day = String(value.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

function parseNumericSearchParam(value: string | null): number | '' {
  if (!value) {
    return ''
  }

  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : ''
}

function normalizeScopeRole(value: string | null): SellerScopeParams['scope_role'] {
  if (value === 'manager_parent' || value === 'manager' || value === 'reseller') {
    return value
  }

  return ''
}

function getScopeHint(
  t: ReturnType<typeof useTranslation>['t'],
  scope: SellerScopeParams,
) {
  if (!scope.scope_role) {
    return ''
  }

  const scopeName = scope.scope_name || t(`managerParent.pages.financialReports.scopeRoles.${scope.scope_role}`)

  return t('managerParent.pages.financialReports.scopeHint', { name: scopeName })
}

function buildScopedCustomersPath(path: string, scope: SellerScopeParams, extras?: Record<string, string>) {
  const params = new URLSearchParams()

  if (scope.manager_parent_id) params.set('manager_parent_id', String(scope.manager_parent_id))
  if (scope.manager_id) params.set('manager_id', String(scope.manager_id))
  if (scope.reseller_id) params.set('reseller_id', String(scope.reseller_id))
  if (scope.scope_name) params.set('scope_name', scope.scope_name)
  if (scope.scope_role) params.set('scope_role', scope.scope_role)
  if (extras) {
    Object.entries(extras).forEach(([key, value]) => {
      if (value) {
        params.set(key, value)
      }
    })
  }

  const query = params.toString()
  return query ? `${path}?${query}` : path
}
