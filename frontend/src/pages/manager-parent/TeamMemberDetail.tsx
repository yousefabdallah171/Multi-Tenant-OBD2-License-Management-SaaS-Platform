import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router-dom'
import { PageHeader } from '@/components/manager-parent/PageHeader'
import { DataTable, type DataTableColumn } from '@/components/shared/DataTable'
import { EmptyState } from '@/components/shared/EmptyState'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useLanguage } from '@/hooks/useLanguage'
import { formatCurrency, formatDate } from '@/lib/utils'
import { routePaths } from '@/router/routes'
import { teamService } from '@/services/team.service'
import type { TeamMemberDetail } from '@/types/manager-parent.types'

type DetailStatus = 'active' | 'suspended' | 'cancelled' | 'inactive' | 'expired' | 'pending' | 'scheduled' | 'scheduled_failed' | 'removed' | 'online' | 'offline' | 'degraded' | 'unknown'

export function TeamMemberDetailPage() {
  const { t } = useTranslation()
  const { lang } = useLanguage()
  const locale = lang === 'ar' ? 'ar-EG' : 'en-US'
  const params = useParams()
  const id = Number(params.id)

  const detailQuery = useQuery({
    queryKey: ['manager-parent', 'team', 'detail-page', id],
    queryFn: () => teamService.getOne(id),
    enabled: Number.isFinite(id) && id > 0,
  })

  const member = detailQuery.data?.data
  const historyColumns: Array<DataTableColumn<TeamMemberDetail['seller_log_history'][number]>> = [
    {
      key: 'created_at',
      label: t('common.timestamp'),
      render: (row) => row.created_at ? formatDate(row.created_at, locale) : '-',
    },
    {
      key: 'action',
      label: t('common.action'),
      render: (row) => row.action,
    },
    {
      key: 'customer',
      label: t('common.customer'),
      render: (row) => row.customer_id
        ? (
          <Link className="text-sky-600 hover:underline dark:text-sky-300" to={routePaths.managerParent.customerDetail(lang, row.customer_id)}>
            {row.customer_name ?? '-'}
          </Link>
          )
        : (row.customer_name ?? '-'),
    },
    {
      key: 'program',
      label: t('common.program'),
      render: (row) => row.program_name ?? '-',
    },
    {
      key: 'bios_id',
      label: t('activate.biosId'),
      render: (row) => row.bios_id
        ? (
          <Link className="text-sky-600 hover:underline dark:text-sky-300" to={`${routePaths.managerParent.biosDetails(lang)}?bios=${encodeURIComponent(row.bios_id)}`}>
            {row.bios_id}
          </Link>
          )
        : '-',
    },
    {
      key: 'price',
      label: t('common.price'),
      render: (row) => row.price === null ? '-' : formatCurrency(row.price, 'USD', locale),
    },
    {
      key: 'status',
      label: t('common.status'),
      render: (row) => row.license_status ? <StatusBadge status={row.license_status as DetailStatus} /> : '-',
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title={member?.name ?? t('managerParent.pages.teamManagement.title')}
        description={member?.email ?? t('managerParent.pages.teamManagement.description')}
      />

      {member ? (
        <>
          <div className="grid gap-4 md:grid-cols-4">
            <MetricCard label={t('common.username')} value={member.username ?? '-'} />
            <MetricCard label={t('managerParent.pages.teamManagement.customers')} value={member.customers_count} />
            <MetricCard label={t('managerParent.pages.teamManagement.activeLicenses')} value={member.active_licenses_count} />
            <MetricCard label={t('common.revenue')} value={formatCurrency(member.revenue, 'USD', locale)} />
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <MetricCard label={t('common.status')} value={<StatusBadge status={member.status} />} />
            <MetricCard label={t('managerParent.pages.usernameManagement.locked')} value={<StatusBadge status={member.username_locked ? 'suspended' : 'active'} />} />
            <MetricCard label={t('common.role')} value={member.role} />
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">{t('manager.pages.team.recentLicenses')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {member.recent_licenses.length === 0 ? (
                <EmptyState title={t('common.noData')} description={t('common.adjustFilters')} />
              ) : (
                member.recent_licenses.map((license) => (
                  <div key={license.id} className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
                    <p className="font-medium text-slate-950 dark:text-white">{license.customer?.name ?? '-'}</p>
                    <p className="text-sm text-slate-500 dark:text-slate-400">{license.customer?.email ?? '-'}</p>
                    <p className="text-sm text-slate-600 dark:text-slate-300">{license.program ?? '-'}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {t('activate.biosId')}{' '}
                      <Link className="text-sky-600 hover:underline dark:text-sky-300" to={`${routePaths.managerParent.biosDetails(lang)}?bios=${encodeURIComponent(license.bios_id)}`}>
                        {license.bios_id}
                      </Link>
                    </p>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">{t('managerParent.nav.activity')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {member.recent_activity.length === 0 ? (
                <EmptyState title={t('common.noData')} description={t('managerParent.pages.activity.noMatches')} />
              ) : (
                member.recent_activity.map((entry) => (
                  <div key={entry.id} className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
                    <p className="font-medium text-slate-950 dark:text-white">{entry.action}</p>
                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{entry.description ?? '-'}</p>
                    <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">{entry.created_at ? formatDate(entry.created_at, locale) : '-'}</p>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Reseller Activation History</CardTitle>
            </CardHeader>
            <CardContent>
              <DataTable
                columns={historyColumns}
                data={member.seller_log_history}
                rowKey={(row) => row.id}
                emptyMessage={t('managerParent.pages.activity.noMatches')}
              />
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  )
}

function MetricCard({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</p>
        <div className="mt-2 font-semibold text-slate-950 dark:text-white">{value}</div>
      </CardContent>
    </Card>
  )
}
